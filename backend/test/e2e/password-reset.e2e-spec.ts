import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { PrismaClient } from '@prisma/client';
import { startTestApp } from '../helpers/test-app';
import { truncateAll } from '../helpers/test-db';
import { hashPassword, verifyPassword } from '../../src/common/crypto/password';
import { resetUserPassword } from '../../src/auth/password-reset';

const JSON_HEADERS = { 'x-repassa-request': '1', 'content-type': 'application/json' };
const MARKER = { 'x-repassa-request': '1' };
const OLD_PASSWORD = 'senha-antiga-12345';
const NEW_PASSWORD = 'nova-senha-forte-12345';

interface AuthBody {
  accessToken?: string;
  user?: { id: string; email: string; role: string };
}

function extractRefreshCookie(res: Response): string {
  const raw = res.headers.getSetCookie().find((c) => c.startsWith('repassa_refresh='));
  expect(raw).toBeDefined();
  return raw!.split(';', 1)[0].slice('repassa_refresh='.length);
}

describe('administrative password reset (e2e, real Postgres)', () => {
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
    const headers: Record<string, string> = { connection: 'close', ...init?.headers };
    if (!init?.body) delete headers['content-type'];
    return fetch(`${baseUrl}${path}`, { method, ...init, headers });
  }

  async function login(email: string, password: string): Promise<{ res: Response; body: AuthBody; cookie?: string }> {
    const res = await req('POST', '/api/v1/auth/login', {
      headers: JSON_HEADERS,
      body: JSON.stringify({ email, password }),
    });
    const body = (await res.json()) as AuthBody;
    return { res, body, cookie: res.status === 200 ? extractRefreshCookie(res) : undefined };
  }

  async function seedStaffUser(email: string) {
    const institution = await prisma.institution.create({
      data: {
        name: 'Instituição Reset (fictícia)',
        publicAddress: 'Rua Fictícia, 10',
        pickupInstructions: 'Secretaria',
        status: 'APPROVED',
        isActive: true,
      },
    });
    const user = await prisma.user.create({
      data: {
        email,
        displayName: 'Pessoa Reset',
        passwordHash: await hashPassword(OLD_PASSWORD),
        role: 'STAFF',
        isActive: true,
      },
    });
    const membership = await prisma.membership.create({
      data: { userId: user.id, institutionId: institution.id },
    });
    return { user, institution, membership };
  }

  it('resets only the password, revokes sessions, invalidates prior tokens and writes safe audit', async () => {
    const email = 'staff.reset@example.com';
    const seeded = await seedStaffUser(email);
    const first = await login(email, OLD_PASSWORD);
    const second = await login(email, OLD_PASSWORD);
    expect(first.res.status).toBe(200);
    expect(second.res.status).toBe(200);

    const before = await prisma.user.findUniqueOrThrow({ where: { id: seeded.user.id } });
    const result = await resetUserPassword(prisma, {
      email: email.toUpperCase(),
      password: NEW_PASSWORD,
    });

    expect(result.userId).toBe(before.id);
    expect(result.email).toBe(email);
    expect(result.sessionsRevoked).toBe(2);
    expect(result.unrevokedSessions).toBe(0);

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: before.id },
      include: { memberships: true },
    });
    expect(after.id).toBe(before.id);
    expect(after.email).toBe(before.email);
    expect(after.displayName).toBe(before.displayName);
    expect(after.role).toBe(before.role);
    expect(after.isActive).toBe(before.isActive);
    expect(after.createdAt).toEqual(before.createdAt);
    expect(after.memberships.map((m) => m.id)).toEqual([seeded.membership.id]);
    expect(after.passwordHash).not.toBe(before.passwordHash);
    expect(after.passwordHash).toMatch(/^\$argon2id\$/);
    await expect(verifyPassword(after.passwordHash, NEW_PASSWORD)).resolves.toBe(true);
    await expect(verifyPassword(after.passwordHash, OLD_PASSWORD)).resolves.toBe(false);

    const sessions = await prisma.refreshSession.findMany({ where: { userId: before.id } });
    expect(sessions).toHaveLength(2);
    expect(sessions.every((s) => s.revokedAt !== null)).toBe(true);

    // Refresh cookies presented before the reset can no longer be rotated.
    for (const cookie of [first.cookie, second.cookie]) {
      const refresh = await req('POST', '/api/v1/auth/refresh', {
        headers: { ...MARKER, cookie: `repassa_refresh=${cookie}` },
      });
      expect(refresh.status).toBe(401);
    }

    // Access JWTs issued before the credential change are also refused immediately.
    for (const token of [first.body.accessToken, second.body.accessToken]) {
      const me = await req('GET', '/api/v1/me', {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(me.status).toBe(401);
    }

    // The old password stays rejected; the new password performs a normal login.
    expect((await login(email, OLD_PASSWORD)).res.status).toBe(401);
    const fresh = await login(email, NEW_PASSWORD);
    expect(fresh.res.status).toBe(200);
    const me = await req('GET', '/api/v1/me', {
      headers: { authorization: `Bearer ${fresh.body.accessToken}` },
    });
    expect(me.status).toBe(200);

    const audit = await prisma.auditEvent.findFirst({
      where: { action: 'admin.password_reset' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).not.toBeNull();
    expect(audit!.actorId).toBeNull();
    expect(audit!.metadata).toMatchObject({
      targetUserId: before.id,
      sessionsRevoked: 2,
      unrevokedSessions: 0,
    });
    const auditText = JSON.stringify(audit!.metadata);
    expect(auditText).not.toContain(OLD_PASSWORD);
    expect(auditText).not.toContain(NEW_PASSWORD);
    expect(auditText).not.toContain(after.passwordHash);
  });

  it('never leaves an unrevoked session when login races the reset', async () => {
    for (let i = 0; i < 3; i++) {
      const email = `race.reset.${i}@example.com`;
      const seeded = await seedStaffUser(email);
      const [loginOutcome, resetOutcome] = await Promise.allSettled([
        login(email, OLD_PASSWORD),
        resetUserPassword(prisma, { email, password: NEW_PASSWORD }),
      ]);

      if (resetOutcome.status === 'rejected') throw resetOutcome.reason;
      expect(loginOutcome.status).toBe('fulfilled');
      if (loginOutcome.status === 'fulfilled' && loginOutcome.value.res.status === 200) {
        expect(loginOutcome.value.cookie).toBeDefined();
        const refresh = await req('POST', '/api/v1/auth/refresh', {
          headers: { ...MARKER, cookie: `repassa_refresh=${loginOutcome.value.cookie}` },
        });
        expect(refresh.status).toBe(401);
      }
      expect(
        await prisma.refreshSession.count({ where: { userId: seeded.user.id, revokedAt: null } }),
      ).toBe(0);
    }
  });

  it('never leaves an unrevoked replacement when refresh rotation races the reset', async () => {
    for (let i = 0; i < 2; i++) {
      const email = `rotation.reset.${i}@example.com`;
      const seeded = await seedStaffUser(email);
      const initial = await login(email, OLD_PASSWORD);
      expect(initial.res.status).toBe(200);

      const [rotationOutcome, resetOutcome] = await Promise.allSettled([
        req('POST', '/api/v1/auth/refresh', {
          headers: { ...MARKER, cookie: `repassa_refresh=${initial.cookie}` },
        }),
        resetUserPassword(prisma, { email, password: NEW_PASSWORD }),
      ]);

      if (resetOutcome.status === 'rejected') throw resetOutcome.reason;
      expect(rotationOutcome.status).toBe('fulfilled');
      if (rotationOutcome.status === 'fulfilled') {
        expect([200, 401]).toContain(rotationOutcome.value.status);
        if (rotationOutcome.value.status === 200) {
          const replacement = extractRefreshCookie(rotationOutcome.value);
          const replay = await req('POST', '/api/v1/auth/refresh', {
            headers: { ...MARKER, cookie: `repassa_refresh=${replacement}` },
          });
          expect(replay.status).toBe(401);
        }
      }
      expect(
        await prisma.refreshSession.count({ where: { userId: seeded.user.id, revokedAt: null } }),
      ).toBe(0);
    }
  });

  it('rejects unknown accounts and invalid passwords without mutating or auditing', async () => {
    const email = 'student.reset@example.com';
    await prisma.user.create({
      data: {
        email,
        displayName: 'Estudante Reset',
        passwordHash: await hashPassword(OLD_PASSWORD),
        role: 'STUDENT',
      },
    });

    await expect(
      resetUserPassword(prisma, { email: 'missing@example.com', password: NEW_PASSWORD }),
    ).rejects.toThrow('Account not found');
    await expect(
      resetUserPassword(prisma, { email, password: 'curta' }),
    ).rejects.toThrow('Password must be 12-128 characters');

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await expect(verifyPassword(user.passwordHash, OLD_PASSWORD)).resolves.toBe(true);
    expect(await prisma.auditEvent.count({ where: { action: 'admin.password_reset' } })).toBe(0);
  });
});
