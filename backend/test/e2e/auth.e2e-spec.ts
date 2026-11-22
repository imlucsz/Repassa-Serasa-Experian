import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { PrismaClient } from '@prisma/client';
import { startTestApp } from '../helpers/test-app';
import { truncateAll } from '../helpers/test-db';
import { hashPassword } from '../../src/common/crypto/password';
import { TokenService } from '../../src/auth/token.service';

const REGISTER_PATH = '/api/v1/auth/register';
const LOGIN_PATH = '/api/v1/auth/login';
const REFRESH_PATH = '/api/v1/auth/refresh';
const LOGOUT_PATH = '/api/v1/auth/logout';
const MARKER = { 'x-repassa-request': '1' };
const JSON_HEADERS = { ...MARKER, 'content-type': 'application/json' };
const ALLOWED_ORIGIN = 'http://localhost:3000';
const PASSWORD = 'senha-de-teste-123';

interface ErrorBody {
  code?: string;
  message?: string;
  requestId?: string;
  fieldErrors?: Record<string, string[]>;
}

interface AuthBody {
  accessToken?: string;
  expiresIn?: number;
  user?: { id: string; displayName: string; email: string; role: string };
}

interface RefreshCookie {
  value: string;
  raw: string;
}

/** Reads the repassa_refresh Set-Cookie header (value + attributes). */
function extractRefreshCookie(res: Response): RefreshCookie | null {
  const raw = res.headers.getSetCookie().find((c) => c.startsWith('repassa_refresh='));
  if (!raw) return null;
  const pair = raw.split(';', 1)[0];
  return { value: pair.slice('repassa_refresh='.length), raw };
}

describe('Auth API (e2e, real Postgres)', () => {
  let app: NestFastifyApplication;
  let baseUrl: string;
  let prisma: PrismaClient;

  beforeAll(async () => {
    const running = await startTestApp();
    app = running.app;
    baseUrl = running.baseUrl;
    prisma = new PrismaClient();
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

  function register(
    email: string,
    password = PASSWORD,
    displayName = 'Estudante Teste',
    headers: Record<string, string> = JSON_HEADERS,
  ): Promise<Response> {
    return req('POST', REGISTER_PATH, {
      headers,
      body: JSON.stringify({ displayName, email, password }),
    });
  }

  function login(
    email: string,
    password = PASSWORD,
    headers: Record<string, string> = JSON_HEADERS,
  ): Promise<Response> {
    return req('POST', LOGIN_PATH, { headers, body: JSON.stringify({ email, password }) });
  }

  function refreshWithToken(token: string | undefined, headers: Record<string, string> = MARKER): Promise<Response> {
    return req('POST', REFRESH_PATH, {
      headers: token ? { ...headers, cookie: `repassa_refresh=${token}` } : headers,
    });
  }

  /** Seeds a user directly (keeps the register:ip bucket for register tests). */
  async function seedUser(email: string, isActive = true) {
    return prisma.user.create({
      data: {
        email,
        displayName: 'Estudante Teste',
        passwordHash: await hashPassword(PASSWORD),
        role: 'STUDENT',
        isActive,
      },
    });
  }

  /** Logs in a seeded user and returns its refresh cookie + response body. */
  async function loginAndGetSession(email: string) {
    const res = await login(email);
    expect(res.status).toBe(200);
    const cookie = extractRefreshCookie(res);
    expect(cookie).not.toBeNull();
    return { cookie: cookie!.value, body: (await res.json()) as AuthBody };
  }

  describe('POST /auth/register', () => {
    it('creates a STUDENT, returns contract body and sets the refresh cookie', async () => {
      const res = await register('Ana.Aluna@Example.COM');
      expect(res.status).toBe(201);
      const body = (await res.json()) as AuthBody;
      expect(body.accessToken).toEqual(expect.any(String));
      expect(body.expiresIn).toBe(900);
      expect(body.user?.role).toBe('STUDENT');
      expect(body.user?.email).toBe('ana.aluna@example.com'); // normalized
      expect(Object.keys(body.user ?? {})).toEqual(['id', 'displayName', 'email', 'role']);

      const cookie = extractRefreshCookie(res);
      expect(cookie).not.toBeNull();
      expect(cookie!.raw).toMatch(/HttpOnly/i);
      expect(cookie!.raw).toContain('Path=/api/v1/auth');
      expect(cookie!.raw).toMatch(/SameSite=Strict/i);
      expect(cookie!.raw).toMatch(/Max-Age=604800/);
      expect(cookie!.raw).not.toMatch(/Secure/i); // http test env only

      const db = await prisma.user.findUnique({ where: { email: 'ana.aluna@example.com' } });
      expect(db?.role).toBe('STUDENT');
      expect(db?.passwordHash).toMatch(/^\$argon2id\$/);
      const sessions = await prisma.refreshSession.findMany({ where: { userId: db!.id } });
      expect(sessions).toHaveLength(1);
      expect(sessions[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(sessions[0].tokenHash).not.toBe(cookie!.value); // hashed at rest
    });

    it('rejects role/privilege injection via extra fields', async () => {
      const res = await req('POST', REGISTER_PATH, {
        headers: JSON_HEADERS,
        body: JSON.stringify({
          displayName: 'Malicioso',
          email: 'm@example.com',
          password: PASSWORD,
          role: 'ADMIN',
          isActive: true,
        }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorBody;
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.fieldErrors?.role).toBeDefined();
      expect(await prisma.user.count()).toBe(0);
    });

    it('rejects duplicate email case-insensitively with 409', async () => {
      expect((await register('dup@example.com')).status).toBe(201);
      const res = await register('DUP@example.com');
      expect(res.status).toBe(409);
      expect(((await res.json()) as ErrorBody).code).toBe('CONFLICT');
    });

    it('validates the contract constraints', async () => {
      const res = await req('POST', REGISTER_PATH, {
        headers: JSON_HEADERS,
        body: JSON.stringify({ displayName: 'x', email: 'not-an-email', password: 'short' }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorBody;
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.fieldErrors?.displayName).toBeDefined();
      expect(body.fieldErrors?.email).toBeDefined();
      expect(body.fieldErrors?.password).toBeDefined();
    });

    it('rejects requests without the X-Repassa-Request marker and with a bad origin', async () => {
      const noMarker = await register('a@example.com', PASSWORD, 'Teste', { 'content-type': 'application/json' });
      expect(noMarker.status).toBe(403);
      const badOrigin = await register('b@example.com', PASSWORD, 'Teste', {
        ...JSON_HEADERS,
        origin: 'https://evil.example.com',
      });
      expect(badOrigin.status).toBe(403);
      expect(await prisma.user.count()).toBe(0);
    });

    it('accepts the configured origin and requests without origin (server pathway)', async () => {
      const res = await register('c@example.com', PASSWORD, 'Teste', {
        ...JSON_HEADERS,
        origin: ALLOWED_ORIGIN,
      });
      expect(res.status).toBe(201);
    });
  });

  describe('POST /auth/login', () => {
    it('returns the contract body and sets a new refresh cookie', async () => {
      await seedUser('login@example.com');
      const res = await login('LOGIN@example.com'); // normalized
      expect(res.status).toBe(200);
      const body = (await res.json()) as AuthBody;
      expect(body.user?.email).toBe('login@example.com');
      expect(extractRefreshCookie(res)).not.toBeNull();
    });

    it('returns the identical generic error for unknown email and wrong password', async () => {
      await seedUser('known@example.com');
      const unknown = await login('ghost@example.com');
      const wrongPass = await login('known@example.com', 'wrong-password-1');
      expect(unknown.status).toBe(401);
      expect(wrongPass.status).toBe(401);
      const unknownBody = (await unknown.json()) as ErrorBody;
      const wrongBody = (await wrongPass.json()) as ErrorBody;
      expect(unknownBody.code).toBe('UNAUTHENTICATED');
      expect(wrongBody.code).toBe('UNAUTHENTICATED');
      expect(unknownBody.message).toBe(wrongBody.message);
    });

    it('rejects disabled accounts with the same generic error', async () => {
      const passwordHash = await hashPassword(PASSWORD);
      await prisma.user.create({
        data: {
          email: 'disabled@example.com',
          displayName: 'Inativo',
          passwordHash,
          role: 'STUDENT',
          isActive: false,
        },
      });
      const res = await login('disabled@example.com');
      expect(res.status).toBe(401);
      expect(((await res.json()) as ErrorBody).message).toBe('Invalid credentials');
    });

    it('rate-limits repeated attempts per identity', async () => {
      await seedUser('ratelimit@example.com');
      for (let i = 0; i < 5; i++) {
        expect((await login('ratelimit@example.com', 'wrong-password-1')).status).toBe(401);
      }
      const blocked = await login('ratelimit@example.com', 'wrong-password-1');
      expect(blocked.status).toBe(429);
      expect(((await blocked.json()) as ErrorBody).code).toBe('RATE_LIMITED');
    });
  });

  describe('POST /auth/refresh', () => {
    it('rotates the session and the new pair works end to end', async () => {
      await seedUser('refresh-ok@example.com');
      const { cookie } = await loginAndGetSession('refresh-ok@example.com');
      const res = await refreshWithToken(cookie);
      expect(res.status).toBe(200);
      const rotated = extractRefreshCookie(res);
      expect(rotated).not.toBeNull();
      expect(rotated!.value).not.toBe(cookie);
      const body = (await res.json()) as AuthBody;
      const me = await req('GET', '/api/v1/me', {
        headers: { authorization: `Bearer ${body.accessToken}` },
      });
      expect(me.status).toBe(200);
      expect(((await me.json()) as { email: string }).email).toBe('refresh-ok@example.com');
    });

    it('rejects missing, malformed and unknown refresh tokens', async () => {
      expect((await refreshWithToken(undefined)).status).toBe(401);
      expect((await refreshWithToken('totally-bogus-token')).status).toBe(401);
    });

    it('requires the request marker', async () => {
      await seedUser('refresh-marker@example.com');
      const { cookie } = await loginAndGetSession('refresh-marker@example.com');
      const res = await req('POST', REFRESH_PATH, {
        headers: { cookie: `repassa_refresh=${cookie}` },
      });
      expect(res.status).toBe(403);
    });

    it('rejects an expired session', async () => {
      await seedUser('expired@example.com');
      const { cookie } = await loginAndGetSession('expired@example.com');
      // Backdate both timestamps — expires_at must stay after created_at (CHECK).
      await prisma.refreshSession.updateMany({
        data: {
          createdAt: new Date(Date.now() - 8 * 86_400_000),
          expiresAt: new Date(Date.now() - 60_000),
        },
      });
      const res = await refreshWithToken(cookie);
      expect(res.status).toBe(401);
    });

    it('detects replay: reusing a rotated token revokes the whole family', async () => {
      await seedUser('replay@example.com');
      const { cookie } = await loginAndGetSession('replay@example.com');
      const rotatedRes = await refreshWithToken(cookie);
      expect(rotatedRes.status).toBe(200);
      const rotated = extractRefreshCookie(rotatedRes);

      // Replay of the old token.
      const replay = await refreshWithToken(cookie);
      expect(replay.status).toBe(401);

      // Family revoked: even the legitimately rotated token now fails.
      const after = await refreshWithToken(rotated!.value);
      expect(after.status).toBe(401);

      // Both the replayed original and the family-revoked replacement are
      // recorded as reuse attempts — every revoked-token presentation counts.
      const reuse = await prisma.auditEvent.count({ where: { action: 'auth.refresh_reuse' } });
      expect(reuse).toBe(2);
    });

    it('serializes concurrent refreshes: exactly one wins', async () => {
      await seedUser('concurrent@example.com');
      const { cookie } = await loginAndGetSession('concurrent@example.com');
      const [a, b] = await Promise.all([refreshWithToken(cookie), refreshWithToken(cookie)]);
      const statuses = [a.status, b.status].sort();
      expect(statuses).toEqual([200, 401]);

      // Documented behavior: concurrent reuse revokes the family entirely.
      const sessions = await prisma.refreshSession.findMany();
      expect(sessions.every((s) => s.revokedAt !== null)).toBe(true);
    });
  });

  describe('POST /auth/logout', () => {
    it('returns 204, clears the cookie and revokes the session family', async () => {
      await seedUser('logout@example.com');
      const { cookie } = await loginAndGetSession('logout@example.com');
      const res = await req('POST', LOGOUT_PATH, {
        headers: { ...MARKER, cookie: `repassa_refresh=${cookie}` },
      });
      expect(res.status).toBe(204);
      const cleared = res.headers.getSetCookie().find((c) => c.startsWith('repassa_refresh='));
      expect(cleared).toBeDefined();
      expect(cleared).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
      expect(cleared).toContain('Path=/api/v1/auth');

      expect((await refreshWithToken(cookie)).status).toBe(401);
    });

    it('is safe without a cookie or with an unknown token', async () => {
      expect((await req('POST', LOGOUT_PATH, { headers: MARKER })).status).toBe(204);
      expect(
        (await req('POST', LOGOUT_PATH, {
          headers: { ...MARKER, cookie: 'repassa_refresh=unknown-token' },
        })).status,
      ).toBe(204);
    });

    it('requires the request marker', async () => {
      const res = await req('POST', LOGOUT_PATH, { headers: {} });
      expect(res.status).toBe(403);
    });
  });

  describe('register rate limit', () => {
    it('rejects the 6th registration for the same identity within a minute', async () => {
      for (let i = 0; i < 5; i++) {
        const res = await register('same@example.com');
        expect([201, 409]).toContain(res.status);
      }
      const blocked = await register('same@example.com');
      expect(blocked.status).toBe(429);
    });
  });
});
