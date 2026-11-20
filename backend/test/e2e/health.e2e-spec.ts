import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createTestApp } from '../helpers/test-app';
import { ProbeController } from '../helpers/probe.controller';

describe('Foundation HTTP surface (e2e, real Postgres)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createTestApp({ controllers: [ProbeController] });
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health returns ok with DB connectivity', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    expect(res.headers['cache-control']).toBe('no-store');
    // helmet security headers
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('GET /api/v1/health/live returns ok without DB check', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health/live' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('unknown route returns contract error shape with requestId', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/definitely-missing' });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.code).toBe('NOT_FOUND');
    expect(body.message).toBeDefined();
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(Object.keys(body).sort()).toEqual(['code', 'message', 'requestId']);
  });

  it('validation errors return VALIDATION_ERROR with fieldErrors', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/probe',
      payload: { name: 'ab' },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.fieldErrors.name).toBeDefined();
    expect(body.fieldErrors.kind).toBeDefined();
    expect(body.requestId).toBeDefined();
  });

  it('unknown DTO fields are rejected (forbidNonWhitelisted)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/probe',
      payload: { name: 'valid name', kind: 'A', role: 'ADMIN' },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.fieldErrors.role).toBeDefined();
  });

  it('accepts a valid DTO payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/probe',
      payload: { name: 'valid name', kind: 'A' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ ok: true, name: 'valid name' });
  });

  it('malformed JSON body returns 400 contract error', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/probe',
      headers: { 'content-type': 'application/json' },
      payload: '{invalid json',
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('BAD_REQUEST');
    expect(body.requestId).toBeDefined();
  });

  it('non-JSON content type is rejected by DTO validation', async () => {
    // Nest's Fastify adapter accepts the raw body and DTO validation rejects it
    // before any business logic; contract-safe 400 rather than 415.
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/probe',
      headers: { 'content-type': 'text/plain' },
      payload: 'hello',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('VALIDATION_ERROR');
  });

  it('oversized JSON body returns 413', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/probe',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ name: 'x'.repeat(2 * 1024 * 1024), kind: 'A' }),
    });
    expect(res.statusCode).toBe(413);
    expect(res.json().code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('CORS: allowlisted origin gets ACAO header, unknown origin does not', async () => {
    const allowed = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: { origin: 'http://localhost:3000' },
    });
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3000');

    const denied = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: { origin: 'https://evil.example.com' },
    });
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });
});
