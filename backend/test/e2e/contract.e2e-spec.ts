import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { startTestApp } from '../helpers/test-app';

/**
 * Generated-Swagger surface check: every contract operation implemented in
 * DEV-02 must exist in the served OpenAPI document (API.md integration gate —
 * schema comparison happens on the shared contract review, this guards drift).
 */
describe('Generated OpenAPI surface (e2e)', () => {
  let app: NestFastifyApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const running = await startTestApp();
    app = running.app;
    baseUrl = running.baseUrl;
  });

  afterAll(async () => {
    await app.close();
  });

  it('exposes the implemented contract operations with their methods', async () => {
    const res = await fetch(`${baseUrl}/api/docs-json`, { headers: { connection: 'close' } });
    expect(res.status).toBe(200);
    const doc = (await res.json()) as {
      paths: Record<string, Record<string, { operationId?: string }>>;
    };

    const expected: Record<string, string> = {
      'post /api/v1/auth/register': 'register',
      'post /api/v1/auth/login': 'login',
      'post /api/v1/auth/refresh': 'refresh',
      'post /api/v1/auth/logout': 'logout',
      'get /api/v1/me': 'getMe',
      'patch /api/v1/me': 'updateMe',
      'get /api/v1/institutions': 'listInstitutions',
      'get /api/v1/me/institutions': 'listMyInstitutions',
    };
    for (const [key, operationId] of Object.entries(expected)) {
      const [method, path] = key.split(' ');
      expect(doc.paths[path]?.[method]?.operationId ?? key).toBe(operationId);
    }

    // Required CSRF marker documented on auth POSTs; cookie auth documented.
    const register = doc.paths['/api/v1/auth/register'].post as unknown as {
      parameters?: { name?: string; required?: boolean }[];
    };
    expect(
      register.parameters?.some((p) => p.name === 'X-Repassa-Request' && p.required),
    ).toBe(true);
  });
});
