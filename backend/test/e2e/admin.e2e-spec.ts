import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { PrismaClient, Role } from '@prisma/client';
import { startTestApp } from '../helpers/test-app';
import { truncateAll } from '../helpers/test-db';
import { hashPassword } from '../../src/common/crypto/password';
import { TokenService } from '../../src/auth/token.service';

const JSON_HEADERS = { 'x-repassa-request': '1', 'content-type': 'application/json' };
const PASSWORD = 'senha-de-teste-123';

interface PageBody {
  items: Array<Record<string, unknown>>;
  page: number;
  pageSize: number;
  total: number;
}

describe('Admin endpoints (e2e, real Postgres)', () => {
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
    identityByEmail.clear();
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
    if (!init?.body) delete headers['content-type']; // empty JSON body is a 400 in Fastify
    return fetch(`${baseUrl}${path}`, { method, ...init, headers });
  }

  function authed(token: string, extra?: Record<string, string>): Record<string, string> {
    return { ...JSON_HEADERS, authorization: `Bearer ${token}`, ...extra };
  }

  async function createUser(
    email: string,
    role: Role,
    isActive = true,
  ): Promise<{ id: string }> {
    const user = await prisma.user.create({
      data: { email, displayName: 'Pessoa Teste', passwordHash: await hashPassword(PASSWORD), role, isActive },
      select: { id: true },
    });
    identityByEmail.set(email, { id: user.id, role });
    return user;
  }

  // Mint real access tokens in-process — /auth/login is IP-throttled and
  // already covered by its own spec.
  const identityByEmail = new Map<string, { id: string; role: string }>();

  function accessTokenFor(email: string): Promise<string> {
    const identity = identityByEmail.get(email);
    if (!identity) throw new Error(`unknown test user ${email}`);
    return tokenService.signAccessToken(identity, 900);
  }

  async function adminToken(email = 'admin@t.dev'): Promise<{ id: string; token: string }> {
    const user = await createUser(email, 'ADMIN');
    return { id: user.id, token: await accessTokenFor(email) };
  }

  async function createInstitution(
    status: 'PENDING' | 'APPROVED' | 'REJECTED' = 'APPROVED',
    isActive = true,
  ): Promise<{ id: string }> {
    return prisma.institution.create({
      data: {
        name: `Instituto ${status} (fictício)`,
        publicAddress: 'Av. Fictícia, 1',
        pickupInstructions: 'Balcão',
        status,
        isActive,
      },
      select: { id: true },
    });
  }

  const registrationBody = {
    name: 'Escola Nova (fictícia)',
    publicAddress: 'Rua Nova, 9 — fictício',
    pickupInstructions: 'Portaria, 9h–17h',
  };

  // ── access control ─────────────────────────────────────────────────────────

  describe('authorization', () => {
    const routes: Array<[string, string]> = [
      ['GET', '/api/v1/admin/institutions'],
      ['GET', '/api/v1/admin/users'],
      ['GET', '/api/v1/admin/materials'],
      ['GET', '/api/v1/admin/reservations'],
      ['GET', '/api/v1/admin/audit-events'],
      ['POST', '/api/v1/admin/institutions/00000000-0000-4000-8000-000000000001/approve'],
    ];

    it('rejects unauthenticated calls with 401', async () => {
      for (const [method, path] of routes) {
        const res = await req(method, path, { headers: JSON_HEADERS });
        expect(res.status).toBe(401);
      }
    });

    it('rejects STUDENT and STAFF with 403 on every admin route', async () => {
      const student = await createUser('s@t.dev', 'STUDENT');
      const staff = await createUser('f@t.dev', 'STAFF');
      void student;
      void staff;
      for (const [method, path] of routes) {
        for (const email of ['s@t.dev', 'f@t.dev']) {
          const token = await accessTokenFor(email);
          const res = await req(method, path, { headers: authed(token) });
          expect(res.status).toBe(403);
        }
      }
    });
  });

  // ── institution registration + approval ────────────────────────────────────

  describe('POST /institutions registration + admin approval', () => {
    it('authenticated user registers a PENDING institution invisible to the public', async () => {
      await createUser('s@t.dev', 'STUDENT');
      const token = await accessTokenFor('s@t.dev');
      const res = await req('POST', '/api/v1/institutions', {
        headers: authed(token),
        body: JSON.stringify(registrationBody),
      });
      expect(res.status).toBe(201);
      const created = (await res.json()) as { id: string };
      const stored = await prisma.institution.findUnique({ where: { id: created.id } });
      expect(stored?.status).toBe('PENDING');
      expect(stored?.isActive).toBe(false);

      const list = (await (await req('GET', '/api/v1/institutions')).json()) as PageBody;
      expect(list.items.map((i) => i.id)).not.toContain(created.id);

      // Submitter gains no staff privileges or membership.
      const memberships = await prisma.membership.count({ where: { institutionId: created.id } });
      expect(memberships).toBe(0);
      const audit = await prisma.auditEvent.findFirst({ where: { action: 'institution.register' } });
      expect(audit?.institutionId).toBe(created.id);
    });

    it('rejects duplicate name+address while pending/approved, allows re-register after rejection', async () => {
      await createUser('s@t.dev', 'STUDENT');
      const token = await accessTokenFor('s@t.dev');
      const { token: adminJwt } = await adminToken('admin@t.dev');

      const first = await req('POST', '/api/v1/institutions', {
        headers: authed(token),
        body: JSON.stringify(registrationBody),
      });
      expect(first.status).toBe(201);
      const created = (await first.json()) as { id: string };

      const dup = await req('POST', '/api/v1/institutions', {
        headers: authed(token),
        body: JSON.stringify(registrationBody),
      });
      expect(dup.status).toBe(409);

      // Same name alone is not a duplicate — address differs.
      const notDup = await req('POST', '/api/v1/institutions', {
        headers: authed(token),
        body: JSON.stringify({ ...registrationBody, publicAddress: 'Outro endereço fictício, 77' }),
      });
      expect(notDup.status).toBe(201);

      // After rejection the name+address pair is free again.
      const reject = await req('POST', `/api/v1/admin/institutions/${created.id}/reject`, {
        headers: authed(adminJwt),
        body: JSON.stringify({ reason: 'Dados insuficientes' }),
      });
      expect(reject.status).toBe(200);
      const again = await req('POST', '/api/v1/institutions', {
        headers: authed(token),
        body: JSON.stringify(registrationBody),
      });
      expect(again.status).toBe(201);
    });

    it('rate-limits registration spam per user', async () => {
      await createUser('s@t.dev', 'STUDENT');
      const token = await accessTokenFor('s@t.dev');
      const statuses: number[] = [];
      for (let i = 0; i < 6; i++) {
        const res = await req('POST', '/api/v1/institutions', {
          headers: authed(token),
          body: JSON.stringify({ ...registrationBody, name: `Escola ${i} (fictícia)`, publicAddress: `Rua ${i}, fictício` }),
        });
        statuses.push(res.status);
      }
      expect(statuses.slice(0, 5)).toEqual([201, 201, 201, 201, 201]);
      expect(statuses[5]).toBe(429);
    });

    it('rejects institution registration without a token', async () => {
      const res = await req('POST', '/api/v1/institutions', {
        headers: JSON_HEADERS,
        body: JSON.stringify(registrationBody),
      });
      expect(res.status).toBe(401);
    });

    it('validates registration fields', async () => {
      await createUser('s@t.dev', 'STUDENT');
      const token = await accessTokenFor('s@t.dev');
      const res = await req('POST', '/api/v1/institutions', {
        headers: authed(token),
        body: JSON.stringify({ name: 'ab', publicAddress: '', pickupInstructions: 'x' }),
      });
      expect(res.status).toBe(400);
    });

    it('admin approves PENDING → APPROVED+active and it becomes public; repeat is 409', async () => {
      const { token } = await adminToken();
      const inst = await createInstitution('PENDING', false);
      const res = await req('POST', `/api/v1/admin/institutions/${inst.id}/approve`, {
        headers: authed(token),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { status: string; isActive: boolean };
      expect(body.status).toBe('APPROVED');
      expect(body.isActive).toBe(true);

      const list = (await (await req('GET', '/api/v1/institutions')).json()) as PageBody;
      expect(list.items.map((i) => i.id)).toContain(inst.id);

      const again = await req('POST', `/api/v1/admin/institutions/${inst.id}/approve`, {
        headers: authed(token),
      });
      expect(again.status).toBe(409);

      const audit = await prisma.auditEvent.findFirst({ where: { action: 'admin.institution_approve' } });
      expect(audit?.institutionId).toBe(inst.id);
    });

    it('admin rejects PENDING → REJECTED with mandatory reason; rejected cannot be approved', async () => {
      const { token } = await adminToken();
      const inst = await createInstitution('PENDING', false);

      const noReason = await req('POST', `/api/v1/admin/institutions/${inst.id}/reject`, {
        headers: authed(token),
        body: JSON.stringify({}),
      });
      expect(noReason.status).toBe(400);

      const res = await req('POST', `/api/v1/admin/institutions/${inst.id}/reject`, {
        headers: authed(token),
        body: JSON.stringify({ reason: 'Endereço não confirmado' }),
      });
      expect(res.status).toBe(200);
      expect(((await res.json()) as { status: string }).status).toBe('REJECTED');

      const approve = await req('POST', `/api/v1/admin/institutions/${inst.id}/approve`, {
        headers: authed(token),
      });
      expect(approve.status).toBe(409);
    });

    it('returns 404 for unknown institution ids', async () => {
      const { token } = await adminToken();
      const res = await req('POST', `/api/v1/admin/institutions/${crypto.randomUUID()}/approve`, {
        headers: authed(token),
      });
      expect(res.status).toBe(404);
    });
  });

  // ── activation / deactivation ───────────────────────────────────────────────

  describe('institution activation', () => {
    it('deactivated approved institution leaves the catalog, blocks donations and new reservations', async () => {
      const { token } = await adminToken();
      const inst = await createInstitution('APPROVED', true);
      const donor = await createUser('d@t.dev', 'STUDENT');
      const student = await createUser('s@t.dev', 'STUDENT');
      const staff = await createUser('f@t.dev', 'STAFF');
      await prisma.membership.create({ data: { userId: staff.id, institutionId: inst.id } });
      const material = await prisma.material.create({
        data: {
          donorId: donor.id,
          institutionId: inst.id,
          title: 'Livro de teste válido',
          description: 'Descrição longa o suficiente para passar na validação.',
          category: 'BOOK',
          condition: 'GOOD',
          status: 'AVAILABLE',
        },
        select: { id: true },
      });

      const off = await req('POST', `/api/v1/admin/institutions/${inst.id}/deactivate`, {
        headers: authed(token),
      });
      expect(off.status).toBe(200);

      // Public catalog + donation target + reservation all gate on APPROVED+active.
      const list = (await (await req('GET', '/api/v1/institutions')).json()) as PageBody;
      expect(list.items.map((i) => i.id)).not.toContain(inst.id);

      const donorToken = await accessTokenFor('d@t.dev');
      const donation = await req('POST', '/api/v1/donations', {
        headers: authed(donorToken),
        body: JSON.stringify({
          institutionId: inst.id,
          title: 'Livro novo doado',
          description: 'Descrição longa o suficiente para passar na validação.',
          category: 'BOOK',
          condition: 'FAIR',
        }),
      });
      expect(donation.status).toBe(400);

      const studentToken = await accessTokenFor('s@t.dev');
      const reserve = await req('POST', `/api/v1/materials/${material.id}/reservations`, {
        headers: authed(studentToken),
      });
      expect([404, 400, 409]).toContain(reserve.status);
      void student;

      const again = await req('POST', `/api/v1/admin/institutions/${inst.id}/deactivate`, {
        headers: authed(token),
      });
      expect(again.status).toBe(409);

      const back = await req('POST', `/api/v1/admin/institutions/${inst.id}/activate`, {
        headers: authed(token),
      });
      expect(back.status).toBe(200);
      const listed = (await (await req('GET', '/api/v1/institutions')).json()) as PageBody;
      expect(listed.items.map((i) => i.id)).toContain(inst.id);
    });

    it('in-flight reservations still complete and cancel after deactivation', async () => {
      const { token } = await adminToken();
      const inst = await createInstitution('APPROVED', true);
      const donor = await createUser('d@t.dev', 'STUDENT');
      await createUser('s@t.dev', 'STUDENT');
      const staff = await createUser('f@t.dev', 'STAFF');
      await prisma.membership.create({ data: { userId: staff.id, institutionId: inst.id } });
      const mkMaterial = (title: string) =>
        prisma.material.create({
          data: {
            donorId: donor.id,
            institutionId: inst.id,
            title,
            description: 'Descrição longa o suficiente para passar na validação.',
            category: 'BOOK',
            condition: 'GOOD',
            status: 'AVAILABLE',
          },
          select: { id: true },
        });
      const m1 = await mkMaterial('Livro reservável de teste');
      const m2 = await mkMaterial('Segundo livro reservável');

      // Two real reservations BEFORE deactivation — one to pick up, one to cancel.
      const studentToken = await accessTokenFor('s@t.dev');
      const r1 = await req('POST', `/api/v1/materials/${m1.id}/reservations`, { headers: authed(studentToken) });
      const r2 = await req('POST', `/api/v1/materials/${m2.id}/reservations`, { headers: authed(studentToken) });
      expect(r1.status).toBe(201);
      expect(r2.status).toBe(201);
      const { pickupCode } = (await r1.json()) as { pickupCode: string };
      const { id: resId2 } = (await r2.json()) as { id: string };

      const off = await req('POST', `/api/v1/admin/institutions/${inst.id}/deactivate`, {
        headers: authed(token),
      });
      expect(off.status).toBe(200);

      // Staff pickup confirmation still completes (deactivation stops new
      // intake, never strands an in-flight pickup — business rule).
      const staffToken = await accessTokenFor('f@t.dev');
      const pickup = await req('POST', `/api/v1/institutions/${inst.id}/pickups/confirm`, {
        headers: authed(staffToken),
        body: JSON.stringify({ code: pickupCode }),
      });
      expect(pickup.status).toBe(200);
      expect(((await pickup.json()) as { status: string }).status).toBe('COMPLETED');

      // Owner cancellation still works on the deactivated institution.
      const cancel = await req('POST', `/api/v1/reservations/${resId2}/cancel`, {
        headers: authed(studentToken),
      });
      expect(cancel.status).toBe(200);
      expect(((await cancel.json()) as { status: string }).status).toBe('CANCELED');
    });

    it('pending and rejected institutions cannot be activated', async () => {
      const { token } = await adminToken();
      for (const status of ['PENDING', 'REJECTED'] as const) {
        const inst = await createInstitution(status, false);
        const res = await req('POST', `/api/v1/admin/institutions/${inst.id}/activate`, {
          headers: authed(token),
        });
        expect(res.status).toBe(409);
      }
    });
  });

  // ── memberships ────────────────────────────────────────────────────────────

  describe('staff membership administration', () => {
    it('assign grants STAFF role + membership; revoke demotes on last membership', async () => {
      const { token } = await adminToken();
      const inst = await createInstitution('APPROVED', true);
      const user = await createUser('s@t.dev', 'STUDENT');
      const userToken = await accessTokenFor('s@t.dev');

      const assign = await req('POST', `/api/v1/admin/institutions/${inst.id}/members`, {
        headers: authed(token),
        body: JSON.stringify({ userId: user.id }),
      });
      expect(assign.status).toBe(201);
      const stored = await prisma.user.findUnique({ where: { id: user.id } });
      expect(stored?.role).toBe('STAFF');
      const membership = await prisma.membership.findUnique({
        where: { userId_institutionId: { userId: user.id, institutionId: inst.id } },
      });
      expect(membership).not.toBeNull();

      // The promoted user can now reach staff-scope endpoints.
      const mine = await req('GET', '/api/v1/me/institutions', { headers: authed(userToken) });
      expect(mine.status).toBe(200);
      expect(((await mine.json()) as PageBody).items.map((i) => i.id)).toContain(inst.id);

      const dup = await req('POST', `/api/v1/admin/institutions/${inst.id}/members`, {
        headers: authed(token),
        body: JSON.stringify({ userId: user.id }),
      });
      expect(dup.status).toBe(409);

      const revoke = await req('POST', `/api/v1/admin/institutions/${inst.id}/members/${user.id}/revoke`, {
        headers: authed(token),
      });
      expect(revoke.status).toBe(204);
      const after = await prisma.user.findUnique({ where: { id: user.id } });
      expect(after?.role).toBe('STUDENT');
      const mine2 = await req('GET', '/api/v1/me/institutions', { headers: authed(userToken) });
      expect(mine2.status).toBe(403);
    });

    it('blocks assignment to pending institutions, ADMIN users and deactivated users', async () => {
      const { id: adminId, token } = await adminToken();
      const pending = await createInstitution('PENDING', false);
      const approved = await createInstitution('APPROVED', true);
      const user = await createUser('s@t.dev', 'STUDENT');
      const inactive = await createUser('i@t.dev', 'STUDENT', false);

      const onPending = await req('POST', `/api/v1/admin/institutions/${pending.id}/members`, {
        headers: authed(token),
        body: JSON.stringify({ userId: user.id }),
      });
      expect(onPending.status).toBe(409);

      const onAdmin = await req('POST', `/api/v1/admin/institutions/${approved.id}/members`, {
        headers: authed(token),
        body: JSON.stringify({ userId: adminId }),
      });
      expect(onAdmin.status).toBe(409);

      const onInactive = await req('POST', `/api/v1/admin/institutions/${approved.id}/members`, {
        headers: authed(token),
        body: JSON.stringify({ userId: inactive.id }),
      });
      expect(onInactive.status).toBe(409);

      const missing = await req('POST', `/api/v1/admin/institutions/${approved.id}/members/${user.id}/revoke`, {
        headers: authed(token),
      });
      expect(missing.status).toBe(404);
    });
  });

  // ── users ──────────────────────────────────────────────────────────────────

  describe('user administration', () => {
    it('deactivated users lose access immediately and refresh sessions are revoked', async () => {
      const { token } = await adminToken();
      const user = await createUser('s@t.dev', 'STUDENT');
      const userToken = await accessTokenFor('s@t.dev');
      await prisma.refreshSession.create({
        data: { userId: user.id, familyId: crypto.randomUUID(), tokenHash: `h-${user.id}`, expiresAt: new Date(Date.now() + 86400000) },
      });

      const res = await req('POST', `/api/v1/admin/users/${user.id}/deactivate`, {
        headers: authed(token),
      });
      expect(res.status).toBe(200);

      const denied = await req('GET', '/api/v1/me', { headers: authed(userToken) });
      expect(denied.status).toBe(401);
      const live = await prisma.refreshSession.count({ where: { userId: user.id, revokedAt: null } });
      expect(live).toBe(0);

      const back = await req('POST', `/api/v1/admin/users/${user.id}/activate`, {
        headers: authed(token),
      });
      expect(back.status).toBe(200);
    });

    it('admin cannot deactivate itself', async () => {
      const { id, token } = await adminToken();
      const res = await req('POST', `/api/v1/admin/users/${id}/deactivate`, {
        headers: authed(token),
      });
      expect(res.status).toBe(409);
    });

    it('role changes are bounded: STUDENT↔STAFF only, ADMIN rows immutable, memberships dropped on demotion', async () => {
      const { token } = await adminToken();
      const inst = await createInstitution('APPROVED', true);
      const user = await createUser('s@t.dev', 'STUDENT');
      const otherAdmin = await createUser('a2@t.dev', 'ADMIN');
      await prisma.membership.create({ data: { userId: user.id, institutionId: inst.id } });

      const toStaff = await req('POST', `/api/v1/admin/users/${user.id}/role`, {
        headers: authed(token),
        body: JSON.stringify({ role: 'STAFF' }),
      });
      expect(toStaff.status).toBe(200);
      expect(((await toStaff.json()) as { role: string }).role).toBe('STAFF');

      const toStudent = await req('POST', `/api/v1/admin/users/${user.id}/role`, {
        headers: authed(token),
        body: JSON.stringify({ role: 'STUDENT' }),
      });
      expect(toStudent.status).toBe(200);
      expect(await prisma.membership.count({ where: { userId: user.id } })).toBe(0);

      const toAdmin = await req('POST', `/api/v1/admin/users/${user.id}/role`, {
        headers: authed(token),
        body: JSON.stringify({ role: 'ADMIN' }),
      });
      expect(toAdmin.status).toBe(400); // DTO rejects ADMIN outright

      const onAdmin = await req('POST', `/api/v1/admin/users/${otherAdmin.id}/role`, {
        headers: authed(token),
        body: JSON.stringify({ role: 'STUDENT' }),
      });
      expect(onAdmin.status).toBe(409);
    });

    it('lists users with role/isActive/q filters and never leaks passwordHash', async () => {
      const { token } = await adminToken('admin@t.dev');
      await createUser('student@t.dev', 'STUDENT');
      await createUser('staff@t.dev', 'STAFF');

      const all = (await (await req('GET', '/api/v1/admin/users', { headers: authed(token) })).json()) as PageBody;
      expect(all.total).toBe(3);
      expect(JSON.stringify(all.items[0])).not.toContain('passwordHash');
      expect(all.items[0]).not.toHaveProperty('passwordHash');

      const staffOnly = (await (
        await req('GET', '/api/v1/admin/users?role=STAFF', { headers: authed(token) })
      ).json()) as PageBody;
      expect(staffOnly.total).toBe(1);

      const found = (await (
        await req('GET', '/api/v1/admin/users?q=student', { headers: authed(token) })
      ).json()) as PageBody;
      expect(found.total).toBe(1);
    });
  });

  // ── read-only views + audit ─────────────────────────────────────────────────

  describe('admin views and audit trail', () => {
    it('lists institutions/materials/reservations across tenants with filters and contract page shape', async () => {
      const { token } = await adminToken();
      const inst = await createInstitution('APPROVED', true);
      const pending = await createInstitution('PENDING', false);
      const donor = await createUser('d@t.dev', 'STUDENT');
      const student = await createUser('s@t.dev', 'STUDENT');
      const mat = await prisma.material.create({
        data: {
          donorId: donor.id,
          institutionId: inst.id,
          title: 'Material visível para admin',
          description: 'Descrição longa o suficiente para passar na validação.',
          category: 'BOOK',
          condition: 'GOOD',
          status: 'PENDING_RECEIPT',
        },
        select: { id: true },
      });
      await prisma.reservation.create({
        data: {
          materialId: mat.id,
          studentId: student.id,
          status: 'ACTIVE',
          codeDigest: `dg-${mat.id}`,
          expiresAt: new Date(Date.now() + 3600000),
        },
      });

      const insts = (await (await req('GET', '/api/v1/admin/institutions', { headers: authed(token) })).json()) as PageBody;
      expect(insts.total).toBe(2);
      const pendingOnly = (await (
        await req('GET', '/api/v1/admin/institutions?status=PENDING', { headers: authed(token) })
      ).json()) as PageBody;
      expect(pendingOnly.total).toBe(1);
      expect(pendingOnly.items[0].id).toBe(pending.id);

      const mats = (await (await req('GET', '/api/v1/admin/materials?status=PENDING_RECEIPT', { headers: authed(token) })).json()) as PageBody;
      expect(mats.total).toBe(1);

      const res = (await (await req('GET', `/api/v1/admin/reservations?institutionId=${inst.id}`, { headers: authed(token) })).json()) as PageBody;
      expect(res.total).toBe(1);
      expect(res.items[0]).not.toHaveProperty('pickupCode');
    });

    it('records admin.* audit events and exposes them via /admin/audit-events', async () => {
      const { id: adminId, token } = await adminToken();
      const inst = await createInstitution('PENDING', false);
      await req('POST', `/api/v1/admin/institutions/${inst.id}/approve`, { headers: authed(token) });

      const events = (await (
        await req('GET', '/api/v1/admin/audit-events?action=admin.', { headers: authed(token) })
      ).json()) as PageBody;
      expect(events.total).toBe(1);
      expect(events.items[0].action).toBe('admin.institution_approve');
      expect(events.items[0].actorId).toBe(adminId);
    });
  });
});
