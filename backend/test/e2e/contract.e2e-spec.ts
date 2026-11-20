import { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { OpenAPIObject } from '@nestjs/swagger';
import { createOpenApiDocument } from '../../src/app.setup';
import { startTestApp } from '../helpers/test-app';

/**
 * Generated-OpenAPI surface check: every contract operation implemented in
 * DEV-02 must exist in the generated document (API.md integration gate —
 * schema comparison happens on the shared contract review, this guards drift).
 * Asserts on the document object directly: Swagger UI serving (@fastify/static)
 * is a bootstrap concern and must not run inside the Jest VM context.
 */
describe('Generated OpenAPI surface (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = (await startTestApp()).app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('exposes the implemented contract operations with their methods', () => {
    const doc = createOpenApiDocument(app) as OpenAPIObject & {
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

    // Required CSRF marker documented on auth POSTs; pagination documented.
    const register = doc.paths['/api/v1/auth/register'].post as unknown as {
      parameters?: { name?: string; required?: boolean }[];
    };
    expect(
      register.parameters?.some((p) => p.name === 'X-Repassa-Request' && p.required),
    ).toBe(true);

    const institutions = doc.paths['/api/v1/institutions'].get as unknown as {
      parameters?: { name?: string }[];
    };
    const paramNames = institutions.parameters?.map((p) => p.name) ?? [];
    expect(paramNames).toEqual(expect.arrayContaining(['page', 'pageSize']));
  });
});
