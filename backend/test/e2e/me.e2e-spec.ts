import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { PrismaClient } from '@prisma/client';
import { startTestApp } from '../helpers/test-app';
import { truncateAll } from '../helpers/test-db';
import { TokenService } from '../../src/auth/token.service';

const JSON_HEADERS = { 'x-repassa-request': '1', 'content-type': 'application/json' };
const PASSWORD = 'senha-de-teste-123';

interface ErrorBody {
  code?: string;
  fieldErrors?: Record<string, string[]>;
}

describe('Profile /me (e2e, real Postgres)', () => {
  let app: NestFastifyApplication;
  let baseUrl: string;
  let prisma: PrismaClient;
  let tokenService: TokenService;

  beforeAll(async () => {
    const running = await startTestApp();
    app = running.app;
    baseUrl = running.baseUrl;
    prisma = new PrismaClient();
    tokenService = app.get(TokenService);
  });

  afterEach(async () => {
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  function req(
    method: string,
    path: string,
    init?: { headers?: Record<string, string>; body?: string },
  ): Promise<Response> {
    return fetch(`${baseUrl}${path}`, {
      method,
      ...init,
      headers: { connection: 'close', ...init?.headers },
    });
  }

  async function createUserAndToken(
    email: string,
    role: 'STUDENT' | 'STAFF' = 'STUDENT',
  ): Promise<{ userId: string; accessToken: string }> {
    const res = await req('POST', '/api/v1/auth/register', {
      headers: JSON_HEADERS,
      body: JSON.stringify({ displayName: 'Estudante', email, password: PASSWORD }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { accessToken: string; user: { id: string } };
    if (role !== 'STUDENT') {
      await prisma.user.update({ where: { id: body.user.id }, data: { role } });
    }
    return { userId: body.user.id, accessToken: body.accessToken };
  }

  describe('GET /me', () => {
    it('returns the contract User for the bearer identity', async () => {
      const { accessToken, userId } = await createUserAndToken('me@example.com');
      const res = await req('GET', '/api/v1/me', {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(Object.keys(body).sort()).toEqual(['displayName', 'email', 'id', 'role']);
      expect(body.id).toBe(userId);
      expect(body.email).toBe('me@example.com');
      expect(body.role).toBe('STUDENT');
      expect(res.headers.get('cache-control')).toBe('no-store');
    });

    it('rejects missing, malformed and tampered tokens', async () => {
      expect((await req('GET', '/api/v1/me')).status).toBe(401);
      expect(
        (await req('GET', '/api/v1/me', { headers: { authorization: 'Bearer not.jwt' } })).status,
      ).toBe(401);
      expect(
        (await req('GET', '/api/v1/me', { headers: { authorization: 'Basic abc' } })).status,
      ).toBe(401);
    });

    it('rejects an expired access token', async () => {
      const { userId } = await createUserAndToken('expired-jwt@example.com');
      const expired = await tokenService.signAccessToken({ id: userId, role: 'STUDENT' }, -60);
      const res = await req('GET', '/api/v1/me', {
        headers: { authorization: `Bearer ${expired}` },
      });
      expect(res.status).toBe(401);
      expect(((await res.json()) as ErrorBody).code).toBe('UNAUTHENTICATED');
    });

    it('rejects a valid token whose user was deactivated or deleted', async () => {
      const { userId, accessToken } = await createUserAndToken('deactivated@example.com');
      await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
      expect(
        (
          await req('GET', '/api/v1/me', { headers: { authorization: `Bearer ${accessToken}` } })
        ).status,
      ).toBe(401);
      await prisma.user.delete({ where: { id: userId } });
      expect(
        (
          await req('GET', '/api/v1/me', { headers: { authorization: `Bearer ${accessToken}` } })
        ).status,
      ).toBe(401);
    });
  });

  describe('PATCH /me', () => {
    it('updates displayName and returns the contract User', async () => {
      const { accessToken } = await createUserAndToken('patch@example.com');
      const res = await req('PATCH', '/api/v1/me', {
        headers: { ...JSON_HEADERS, authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ displayName: 'Novo Nome' }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { displayName: string };
      expect(body.displayName).toBe('Novo Nome');
      const db = await prisma.user.findFirst({ where: { email: 'patch@example.com' } });
      expect(db?.displayName).toBe('Novo Nome');
    });

    it('trims whitespace before validating', async () => {
      const { accessToken } = await createUserAndToken('trim@example.com');
      const res = await req('PATCH', '/api/v1/me', {
        headers: { ...JSON_HEADERS, authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ displayName: '  Ana  ' }),
      });
      expect(res.status).toBe(200);
      expect(((await res.json()) as { displayName: string }).displayName).toBe('Ana');
    });

    it('rejects privilege-escalation fields (role/email/password)', async () => {
      const { accessToken } = await createUserAndToken('escalate@example.com');
      for (const extra of [{ role: 'ADMIN' }, { email: 'x@example.com' }, { password: 'x'.repeat(12) }]) {
        const res = await req('PATCH', '/api/v1/me', {
          headers: { ...JSON_HEADERS, authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ displayName: 'Nome Valido', ...extra }),
        });
        expect(res.status).toBe(400);
        expect(((await res.json()) as ErrorBody).code).toBe('VALIDATION_ERROR');
      }
      const db = await prisma.user.findFirst({ where: { email: 'escalate@example.com' } });
      expect(db?.role).toBe('STUDENT');
      expect(db?.displayName).toBe('Estudante');
    });

    it('validates length constraints and requires displayName', async () => {
      const { accessToken } = await createUserAndToken('validate@example.com');
      const tooShort = await req('PATCH', '/api/v1/me', {
        headers: { ...JSON_HEADERS, authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ displayName: 'a' }),
      });
      expect(tooShort.status).toBe(400);
      expect(((await tooShort.json()) as ErrorBody).fieldErrors?.displayName).toBeDefined();
      const missing = await req('PATCH', '/api/v1/me', {
        headers: { ...JSON_HEADERS, authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({}),
      });
      expect(missing.status).toBe(400);
    });

    it('requires authentication', async () => {
      const res = await req('PATCH', '/api/v1/me', {
        headers: JSON_HEADERS,
        body: JSON.stringify({ displayName: 'Sem Auth' }),
      });
      expect(res.status).toBe(401);
    });
  });
});
