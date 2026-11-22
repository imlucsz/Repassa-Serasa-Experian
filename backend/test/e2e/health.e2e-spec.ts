import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { startTestApp } from '../helpers/test-app';
import { ProbeController } from '../helpers/probe.controller';

interface ResponseBody {
  code?: string;
  message?: string;
  requestId?: string;
  fieldErrors?: Record<string, string[]>;
  status?: string;
  ok?: boolean;
  name?: string;
}

async function json(res: Response): Promise<ResponseBody> {
  return (await res.json()) as ResponseBody;
}

describe('Foundation HTTP surface (e2e, real Postgres)', () => {
  let app: NestFastifyApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const running = await startTestApp({ controllers: [ProbeController] });
    app = running.app;
    baseUrl = running.baseUrl;
  });

  afterAll(async () => {
    await app.close();
  });

  function req(
    method: string,
    path: string,
    init?: { headers?: Record<string, string>; body?: string },
  ) {
    // connection: close avoids undici keep-alive reuse races against sockets
    // the server destroys (e.g. after 413 payload rejections).
    return fetch(`${baseUrl}${path}`, {
      method,
      ...init,
      headers: { connection: 'close', ...init?.headers },
    });
  }

  it('GET /api/v1/health returns ok with DB connectivity', async () => {
    const res = await req('GET', '/api/v1/health');
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ status: 'ok' });
    expect(res.headers.get('cache-control')).toBe('no-store');
    // helmet security headers
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('GET /api/v1/health/live returns ok without DB check', async () => {
    const res = await req('GET', '/api/v1/health/live');
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ status: 'ok' });
  });

  it('unknown route returns contract error shape with requestId', async () => {
    const res = await req('GET', '/api/v1/definitely-missing');
    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.code).toBe('NOT_FOUND');
    expect(body.message).toBeDefined();
    expect(String(body.requestId)).toMatch(/^[0-9a-f-]{36}$/);
    expect(Object.keys(body).sort()).toEqual(['code', 'message', 'requestId']);
  });

  it('validation errors return VALIDATION_ERROR with fieldErrors', async () => {
    const res = await req('POST', '/api/v1/probe', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'ab' }),
    });
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.fieldErrors?.name).toBeDefined();
    expect(body.fieldErrors?.kind).toBeDefined();
    expect(body.requestId).toBeDefined();
  });

  it('unknown DTO fields are rejected (forbidNonWhitelisted)', async () => {
    const res = await req('POST', '/api/v1/probe', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'valid name', kind: 'A', role: 'ADMIN' }),
    });
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.fieldErrors?.role).toBeDefined();
  });

  it('accepts a valid DTO payload', async () => {
    const res = await req('POST', '/api/v1/probe', {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'valid name', kind: 'A' }),
    });
    expect(res.status).toBe(201);
    expect(await json(res)).toEqual({ ok: true, name: 'valid name' });
  });

  it('malformed JSON body returns 400 contract error', async () => {
    const res = await req('POST', '/api/v1/probe', {
      headers: { 'content-type': 'application/json' },
      body: '{invalid json',
    });
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toBe('BAD_REQUEST');
    expect(body.requestId).toBeDefined();
  });

  it('non-JSON content type is rejected by DTO validation', async () => {
    // Nest's Fastify adapter accepts the raw body and DTO validation rejects it
    // before any business logic; contract-safe 400 rather than 415.
    const res = await req('POST', '/api/v1/probe', {
      headers: { 'content-type': 'text/plain' },
      body: 'hello',
    });
    expect(res.status).toBe(400);
    expect((await json(res)).code).toBe('VALIDATION_ERROR');
  });

  it('oversized JSON body returns 413', async () => {
    // The server answers 413 and destroys the socket while the client may
    // still be streaming the oversized body; whether fetch delivers the
    // response or sees the reset is a race — bounded retry covers it.
    let res: Response | undefined;
    for (let attempt = 0; attempt < 3 && !res; attempt++) {
      try {
        res = await req('POST', '/api/v1/probe', {
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'x'.repeat(2 * 1024 * 1024), kind: 'A' }),
        });
      } catch (error) {
        if (attempt === 2) throw error;
      }
    }
    expect(res!.status).toBe(413);
    expect((await json(res!)).code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('CORS: allowlisted origin gets ACAO header, unknown origin does not', async () => {
    const allowed = await req('GET', '/api/v1/health', {
      headers: { origin: 'http://localhost:3000' },
    });
    expect(allowed.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');

    const denied = await req('GET', '/api/v1/health', {
      headers: { origin: 'https://evil.example.com' },
    });
    expect(denied.headers.get('access-control-allow-origin')).toBeNull();
  });
});
