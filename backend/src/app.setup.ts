import { randomUUID } from 'node:crypto';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import { ValidationError } from 'class-validator';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { UPLOAD_MAX_BYTES } from './uploads/upload-policy';
import type { EnvConfig } from './config/env.validation';

export const API_PREFIX = 'api/v1';
const BODY_LIMIT_BYTES = 1024 * 1024; // 1 MiB JSON; photo uploads get scoped limits in DEV-03.

/** Adapter options shared by bootstrap and tests. */
export const FASTIFY_ADAPTER_OPTIONS = {
  logger: false,
  genReqId: (): string => randomUUID(),
  // Only trust X-Forwarded-* behind a known proxy (SECURITY.md); defaults to off.
  trustProxy: process.env.TRUST_PROXY === 'true',
  bodyLimit: BODY_LIMIT_BYTES,
} as const;

/**
 * Applies the shared application surface: security plugins, global prefix,
 * validation, error contract, CORS allowlist and cache policy.
 * Used by bootstrap (main.ts) and by e2e tests to prevent behavior drift.
 */
export async function configureApp(
  app: NestFastifyApplication,
  config: ConfigService<EnvConfig, true>,
): Promise<void> {
  // Security headers; CSP off because this is a JSON API and Swagger UI serves its own assets.
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cookie);
  // Multipart only for POST /uploads: one file, hard 5 MiB cap (contract).
  await app.register(multipart, {
    limits: { fileSize: UPLOAD_MAX_BYTES, files: 1, fields: 4, fieldNameSize: 64 },
  });

  app.setGlobalPrefix(API_PREFIX);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      exceptionFactory: (errors: ValidationError[]) =>
        new BadRequestException({
          message: 'Validation failed',
          fieldErrors: collectFieldErrors(errors),
        }),
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableCors({
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Repassa-Request'],
    maxAge: 600,
    origin: (origin, cb) => {
      // Non-browser clients (no Origin) are not subject to CORS; disallowed
      // browser origins get no CORS headers (never an error — that would 500).
      // Cookie-auth mutations are enforced separately by AuthCsrfGuard.
      cb(null, !origin || config.get('allowedOrigins', { infer: true }).includes(origin));
    },
  });

  // Private/auth responses must not be cached; apply uniformly to the API surface.
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onSend', (request, reply, _payload, done) => {
      if (request.url.startsWith(`/${API_PREFIX}`)) {
        void reply.header('cache-control', 'no-store');
      }
      done();
    });

  app.enableShutdownHooks();
}

/** Builds the generated OpenAPI document — used by Swagger UI and contract tests. */
export function createOpenApiDocument(app: NestFastifyApplication): OpenAPIObject {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('RePassa API')
    .setDescription('RePassa API v0.1 — see docs/repassa/contracts/openapi.yaml')
    .setVersion('0.1.0')
    .addServer(`/${API_PREFIX}`)
    .addBearerAuth()
    .addCookieAuth('repassa_refresh')
    .build();
  return SwaggerModule.createDocument(app, swaggerConfig);
}

/** Swagger UI + JSON document at /api/docs (bootstrap only). */
export function setupSwagger(app: NestFastifyApplication): void {
  SwaggerModule.setup('api/docs', app, createOpenApiDocument(app), {
    jsonDocumentUrl: 'api/docs-json',
  });
}

function collectFieldErrors(errors: ValidationError[], prefix = ''): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const error of errors) {
    const path = prefix ? `${prefix}.${error.property}` : error.property;
    if (error.constraints) {
      fieldErrors[path] = Object.values(error.constraints);
    }
    if (error.children?.length) {
      Object.assign(fieldErrors, collectFieldErrors(error.children, path));
    }
  }
  return fieldErrors;
}
