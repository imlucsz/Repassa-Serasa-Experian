import { jest } from '@jest/globals';
import { ArgumentsHost, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';

interface SentBody {
  code: string;
  message: string;
  requestId: string;
}

function fakeHost(requestId = 'req-test-1') {
  const send = jest.fn<(body: SentBody) => void>();
  const status = jest.fn().mockReturnValue({ send });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ id: requestId }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, send };
}

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  it('maps HttpException 404 to contract shape', () => {
    const { host, status, send } = fakeHost();
    filter.catch(new NotFoundException(), host);
    expect(status).toHaveBeenCalledWith(404);
    expect(send).toHaveBeenCalledWith({
      code: 'NOT_FOUND',
      message: 'Not Found',
      requestId: 'req-test-1',
    });
  });

  it('surfaces validation fieldErrors as VALIDATION_ERROR', () => {
    const { host, send } = fakeHost();
    filter.catch(
      new BadRequestException({
        message: 'Validation failed',
        fieldErrors: { email: ['must be an email'] },
      }),
      host,
    );
    expect(send).toHaveBeenCalledWith({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      requestId: 'req-test-1',
      fieldErrors: { email: ['must be an email'] },
    });
  });

  it('maps Prisma P2002 to 409 CONFLICT without DB details', () => {
    const { host, status, send } = fakeHost();
    const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '6.19.3',
      meta: { target: ['email'] },
    });
    filter.catch(error, host);
    expect(status).toHaveBeenCalledWith(409);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'CONFLICT', message: 'Resource conflict' }),
    );
    expect(send.mock.calls[0][0].message).not.toContain('email');
  });

  it('maps Prisma P2025 to 404', () => {
    const { host, status, send } = fakeHost();
    const error = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '6.19.3',
    });
    filter.catch(error, host);
    expect(status).toHaveBeenCalledWith(404);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOT_FOUND' }));
  });

  it('maps fastify-style errors (413) preserving status', () => {
    const { host, status, send } = fakeHost();
    filter.catch({ statusCode: 413, code: 'FST_ERR_CTP_BODY_TOO_LARGE' }, host);
    expect(status).toHaveBeenCalledWith(413);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ code: 'PAYLOAD_TOO_LARGE' }));
  });

  it('maps unknown errors to 500 without leaking internals', () => {
    const { host, status, send } = fakeHost();
    filter.catch(new Error('database password leaked'), host);
    expect(status).toHaveBeenCalledWith(500);
    const body = send.mock.calls[0][0];
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(body.message).toBe('Internal server error');
    expect(JSON.stringify(body)).not.toContain('password');
    expect(body.requestId).toBe('req-test-1');
  });
});
