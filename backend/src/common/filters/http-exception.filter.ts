import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { FastifyReply, FastifyRequest } from 'fastify';

/** Contract ErrorResponse — see docs/repassa/contracts/openapi.yaml. */
export interface ErrorResponseBody {
  code: string;
  message: string;
  requestId: string;
  fieldErrors?: Record<string, string[]>;
}

const STATUS_CODES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.METHOD_NOT_ALLOWED]: 'METHOD_NOT_ALLOWED',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'UNSUPPORTED_MEDIA_TYPE',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

const STATUS_MESSAGES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Invalid request',
  [HttpStatus.UNAUTHORIZED]: 'Authentication required',
  [HttpStatus.FORBIDDEN]: 'Access denied',
  [HttpStatus.NOT_FOUND]: 'Resource not found',
  [HttpStatus.METHOD_NOT_ALLOWED]: 'Method not allowed',
  [HttpStatus.CONFLICT]: 'Resource conflict',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'Request body too large',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'Unsupported media type',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Too many requests',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'Service unavailable',
};

interface NormalizedError {
  status: number;
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
}

/** Payload a ValidationPipe can throw via exceptionFactory to surface per-field errors. */
export interface ValidationErrorPayload {
  message: string;
  fieldErrors: Record<string, string[]>;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();
    const requestId = typeof request?.id === 'string' ? request.id : 'unknown';

    const error = this.normalize(exception);

    if (error.status >= 500) {
      this.logger.error(
        `requestId=${requestId} status=${error.status} code=${error.code} ${safeErrorDetails(exception)}`,
      );
    } else {
      this.logger.warn(`requestId=${requestId} status=${error.status} code=${error.code}`);
    }

    const body: ErrorResponseBody = {
      code: error.code,
      message: error.message,
      requestId,
      ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
    };

    void reply.status(error.status).send(body);
  }

  private normalize(exception: unknown): NormalizedError {
    if (exception instanceof HttpException) {
      return this.normalizeHttpException(exception);
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.normalizePrismaError(exception);
    }
    if (
      exception instanceof Prisma.PrismaClientInitializationError ||
      exception instanceof Prisma.PrismaClientRustPanicError
    ) {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        code: 'SERVICE_UNAVAILABLE',
        message: STATUS_MESSAGES[HttpStatus.SERVICE_UNAVAILABLE],
      };
    }
    const fastifyError = exception as { statusCode?: unknown; message?: unknown };
    if (
      typeof fastifyError?.statusCode === 'number' &&
      fastifyError.statusCode >= 400 &&
      fastifyError.statusCode < 600
    ) {
      const status = fastifyError.statusCode;
      return {
        status,
        code: STATUS_CODES[status] ?? 'BAD_REQUEST',
        message:
          status === HttpStatus.BAD_REQUEST && typeof fastifyError.message === 'string'
            ? 'Malformed request'
            : (STATUS_MESSAGES[status] ?? 'Invalid request'),
      };
    }
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    };
  }

  private normalizeHttpException(exception: HttpException): NormalizedError {
    const status = exception.getStatus();
    const response = exception.getResponse();

    let message = STATUS_MESSAGES[status] ?? 'Request failed';
    let fieldErrors: Record<string, string[]> | undefined;

    if (typeof response === 'string' && response.length > 0 && status < 500) {
      message = response;
    } else if (response && typeof response === 'object') {
      const body = response as Record<string, unknown>;
      if (body.fieldErrors && typeof body.fieldErrors === 'object') {
        fieldErrors = body.fieldErrors as Record<string, string[]>;
      }
      if (typeof body.message === 'string' && status < 500) {
        message = body.message;
      } else if (Array.isArray(body.message) && status < 500) {
        message = body.message.join('; ');
      }
    }

    const code =
      status === HttpStatus.BAD_REQUEST && fieldErrors
        ? 'VALIDATION_ERROR'
        : (STATUS_CODES[status] ?? 'INTERNAL_ERROR');

    if (status >= 500) {
      message = 'Internal server error';
    }

    return { status, code, message, fieldErrors };
  }

  private normalizePrismaError(exception: Prisma.PrismaClientKnownRequestError): NormalizedError {
    switch (exception.code) {
      case 'P2002': // unique constraint
      case 'P2003': // foreign key
      case 'P2034': // transaction conflict / serialization failure
        return {
          status: HttpStatus.CONFLICT,
          code: 'CONFLICT',
          message: STATUS_MESSAGES[HttpStatus.CONFLICT],
        };
      case 'P2025': // record not found
        return {
          status: HttpStatus.NOT_FOUND,
          code: 'NOT_FOUND',
          message: STATUS_MESSAGES[HttpStatus.NOT_FOUND],
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        };
    }
  }
}

/**
 * 5xx log details must never include raw exception messages: they can embed
 * connection strings, credentials, query values or stack data. Log only the
 * error class and an approved machine-readable classification (framework or
 * Prisma error codes, e.g. FST_ERR_*, P2002), which cannot carry secrets.
 */
const SAFE_CODE_PATTERN = /^[A-Za-z_$][A-Za-z0-9_.$-]{0,60}$/;

function safeErrorDetails(exception: unknown): string {
  const name =
    exception instanceof Error && SAFE_CODE_PATTERN.test(exception.name)
      ? exception.name
      : exception instanceof Error
        ? 'Error'
        : `typeof_${typeof exception}`;
  const code = (exception as { code?: unknown })?.code;
  const codeTag = typeof code === 'string' && SAFE_CODE_PATTERN.test(code) ? ` code=${code}` : '';
  return `error=${name}${codeTag}`;
}
