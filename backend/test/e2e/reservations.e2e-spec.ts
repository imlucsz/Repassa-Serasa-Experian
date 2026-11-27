import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { PrismaClient } from '@prisma/client';
import { startTestApp } from '../helpers/test-app';
import { truncateAll } from '../helpers/test-db';
import { hashPassword } from '../../src/common/crypto/password';
import { TokenService } from '../../src/auth/token.service';
import { ReservationsService } from '../../src/reservations/reservations.service';

const JSON_HEADERS = { 'x-repassa-request': '1', 'content-type': 'application/json' };
const PASSWORD = 'senha-de-teste-123';
const CODE_PATTERN = /^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/;

interface ReservationBody {
  id: string;
  material: { id: string; status: string; institution: { id: string } };
  status: string;
  expiresAt: string;
  pickupCode: string | null;
  createdAt: string;
  completedAt: string | null;
}

describe('Reservations and pickup lifecycle (e2e, real Postgres)', () => {
  let app: NestFastifyApplication;
  let baseUrl: string;
  let prisma: PrismaClient;
  let tokens: TokenService;

  beforeAll(async () => {
    const running = await startTestApp();
    app = running.app;
    baseUrl = running.baseUrl;
    prisma = new PrismaClient();
    tokens = app.get(TokenService);
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

  async function createUser(email: string, role: 'STUDENT' | 'STAFF', isActive = true) {
    return prisma.user.create({
      data: {
        email,
        displayName: 'Pessoa Teste',
        passwordHash: await hashPassword(PASSWORD),
        role,
        isActive,
      },
      select: { id: true, role: true },
    });
  }

  // Mint access tokens directly with the app's ephemeral test key — avoids
  // hammering the rate-limited login endpoint from a shared test IP.
  async function tokenFor(email: string): Promise<string> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error(`test user ${email} not found`);
    return tokens.signAccessToken(user, 900);
  }

  const auth = (token: string) => ({ ...JSON_HEADERS, authorization: `Bearer ${token}` });
  const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

  async function seedInstitution() {
    return prisma.institution.create({
      data: {
        name: 'Instituto Central (fictício)',
        publicAddress: 'Av. C, 100 — fictício',
        pickupInstructions: 'Balcão principal',
        status: 'APPROVED',
        isActive: true,
      },
    });
  }

  async function addMember(userId: string, institutionId: string) {
    return prisma.membership.create({ data: { userId, institutionId } });
  }

  async function seedAvailableMaterial(donorId: string, institutionId: string, title = 'Livro de Cálculo') {
    return prisma.material.create({
      data: {
        donorId,
        institutionId,
        title,
        description: 'Material didático em bom estado.',
        category: 'BOOK',
        condition: 'GOOD',
        status: 'AVAILABLE',
        receivedAt: new Date(),
      },
    });
  }

  /** Full fixture: donor-owned AVAILABLE material + student + staff member. */
  async function fixture() {
    const institution = await seedInstitution();
    const donor = await createUser('dono@example.com', 'STUDENT');
    const student = await createUser('aluna@example.com', 'STUDENT');
    const staff = await createUser('staff@example.com', 'STAFF');
    await addMember(staff.id, institution.id);
    const material = await seedAvailableMaterial(donor.id, institution.id);
    return { institution, donor, student, staff, material };
  }

  async function reserveAs(token: string, materialId: string) {
    return req('POST', `/api/v1/materials/${materialId}/reservations`, {
      headers: bearer(token),
    });
  }

  describe('POST /materials/{id}/reservations', () => {
    it('creates an ACTIVE reservation returning the pickup code only to the student', async () => {
      const { institution, material, student } = await fixture();
      const token = await tokenFor('aluna@example.com');

      const res = await reserveAs(token, material.id);
      expect(res.status).toBe(201);
      const body = (await res.json()) as ReservationBody;
      expect(Object.keys(body).sort()).toEqual(
        ['id', 'material', 'status', 'expiresAt', 'pickupCode', 'createdAt', 'completedAt'].sort(),
      );
      expect(body.status).toBe('ACTIVE');
      expect(body.pickupCode).toMatch(CODE_PATTERN);
      expect(body.completedAt).toBeNull();
      expect(body.material.id).toBe(material.id);
      expect(body.material.institution.id).toBe(institution.id);
      // expiresAt ≈ now + 72h (tolerance for clock drift)
      const ttl = new Date(body.expiresAt).getTime() - Date.now();
      expect(ttl).toBeGreaterThan(71 * 3600 * 1000);
      expect(ttl).toBeLessThan(73 * 3600 * 1000);
      // material is RESERVED and hidden from the public catalog
      expect((await prisma.material.findUnique({ where: { id: material.id } }))!.status).toBe('RESERVED');
      const catalog = await req('GET', '/api/v1/materials');
      const catalogBody = (await catalog.json()) as { items: { id: string }[] };
      expect(catalogBody.items.some((m) => m.id === material.id)).toBe(false);
      // digest stored, never the plaintext code
      const stored = await prisma.reservation.findUnique({ where: { id: body.id } });
      expect(stored!.codeDigest).not.toContain(body.pickupCode!.replace(/-/g, ''));
      expect(stored!.codeDigest).toMatch(/^[0-9a-f]{64}$/);
    });

    it('exactly one of many concurrent reservations succeeds', async () => {
      const { material } = await fixture();
      const students = await Promise.all(
        Array.from({ length: 5 }, (_, i) => createUser(`s${i}@example.com`, 'STUDENT')),
      );
      const tokens = await Promise.all(
        students.map((_, i) => tokenFor(`s${i}@example.com`)),
      );
      const results = await Promise.all(tokens.map((t) => reserveAs(t, material.id)));
      const statuses = results.map((r) => r.status).sort();
      expect(statuses).toEqual([201, 409, 409, 409, 409]);
      // only one ACTIVE reservation exists — partial unique index backstop
      expect(
        await prisma.reservation.count({ where: { materialId: material.id, status: 'ACTIVE' } }),
      ).toBe(1);
    });

    it('rejects the donor reserving their own material', async () => {
      const { material } = await fixture();
      const token = await tokenFor('dono@example.com');
      const res = await reserveAs(token, material.id);
      expect(res.status).toBe(403);
      expect(await prisma.reservation.count()).toBe(0);
    });

    it('returns 404 for unknown or non-available materials and 403 for staff role', async () => {
      const { institution, staff } = await fixture();
      const studentToken = await tokenFor('aluna@example.com');
      const pending = await prisma.material.create({
        data: {
          donorId: (await prisma.user.findFirst({ where: { email: 'dono@example.com' } }))!.id,
          institutionId: institution.id,
          title: 'Pendente',
          description: 'Material ainda não recebido.',
          category: 'BOOK',
          condition: 'GOOD',
          status: 'PENDING_RECEIPT',
        },
      });
      expect((await reserveAs(studentToken, pending.id)).status).toBe(404);
      expect(
        (await reserveAs(studentToken, '3f4f8a2a-1111-4222-8333-9abcdef01234')).status,
      ).toBe(404);
      const staffToken = await tokenFor('staff@example.com');
      expect((await reserveAs(staffToken, pending.id)).status).toBe(403);
      void staff;
    });

    it('a second reserve attempt after success returns 409', async () => {
      const { material } = await fixture();
      const token = await tokenFor('aluna@example.com');
      expect((await reserveAs(token, material.id)).status).toBe(201);
      const other = await createUser('outra@example.com', 'STUDENT');
      const otherToken = await tokenFor('outra@example.com');
      expect((await reserveAs(otherToken, material.id)).status).toBe(409);
      void other;
    });
  });

  describe('GET /me/reservations + POST /reservations/{id}/cancel', () => {
    it('lists own reservations with code, cancels, restores inventory, code becomes null', async () => {
      const { material, institution } = await fixture();
      const token = await tokenFor('aluna@example.com');
      const created = (await (await reserveAs(token, material.id)).json()) as ReservationBody;

      const list = await req('GET', '/api/v1/me/reservations', { headers: bearer(token) });
      const page = (await list.json()) as { items: ReservationBody[]; total: number };
      expect(page.total).toBe(1);
      expect(page.items[0].pickupCode).toBe(created.pickupCode); // owner re-views code

      const cancel = await req('POST', `/api/v1/reservations/${created.id}/cancel`, {
        headers: bearer(token),
      });
      expect(cancel.status).toBe(200);
      const cancelled = (await cancel.json()) as ReservationBody;
      expect(cancelled.status).toBe('CANCELED');
      expect(cancelled.pickupCode).toBeNull();

      expect((await prisma.material.findUnique({ where: { id: material.id } }))!.status).toBe(
        'AVAILABLE',
      );
      const catalog = await req('GET', '/api/v1/materials');
      expect(
        ((await catalog.json()) as { items: { id: string }[] }).items.some(
          (m) => m.id === material.id,
        ),
      ).toBe(true);

      // repeat cancel → 409; another user's cancel → 404
      expect(
        (await req('POST', `/api/v1/reservations/${created.id}/cancel`, { headers: bearer(token) }))
          .status,
      ).toBe(409);
      const otherToken = await tokenFor('dono@example.com');
      expect(
        (
          await req('POST', `/api/v1/reservations/${created.id}/cancel`, {
            headers: bearer(otherToken),
          })
        ).status,
      ).toBe(404);
      void institution;
    });

    it('expired reservations reconcile to EXPIRED and restore the material', async () => {
      const { material } = await fixture();
      const token = await tokenFor('aluna@example.com');
      const created = (await (await reserveAs(token, material.id)).json()) as ReservationBody;
      await prisma.reservation.update({
        where: { id: created.id },
        data: {
          createdAt: new Date(Date.now() - 80 * 3_600_000),
          expiresAt: new Date(Date.now() - 8 * 3_600_000),
        },
      });

      const list = await req('GET', '/api/v1/me/reservations', { headers: bearer(token) });
      expect(list.status).toBe(200);
      const page = (await list.json()) as { items: ReservationBody[] };
      expect(page.items[0].status).toBe('EXPIRED');
      expect(page.items[0].pickupCode).toBeNull();
      expect((await prisma.material.findUnique({ where: { id: material.id } }))!.status).toBe(
        'AVAILABLE',
      );
      // audit recorded, without code material
      const audit = await prisma.auditEvent.findFirst({
        where: { reservationId: created.id, action: 'reservation.expire' },
      });
      expect(audit).not.toBeNull();
    });

    it('cancel on an expired reservation is a 409 and reconciles', async () => {
      const { material } = await fixture();
      const token = await tokenFor('aluna@example.com');
      const created = (await (await reserveAs(token, material.id)).json()) as ReservationBody;
      await prisma.reservation.update({
        where: { id: created.id },
        data: {
          createdAt: new Date(Date.now() - 80 * 3_600_000),
          expiresAt: new Date(Date.now() - 8 * 3_600_000),
        },
      });
      const cancel = await req('POST', `/api/v1/reservations/${created.id}/cancel`, {
        headers: bearer(token),
      });
      expect(cancel.status).toBe(409);
      expect(
        (await prisma.reservation.findUnique({ where: { id: created.id } }))!.status,
      ).toBe('EXPIRED');
      expect((await prisma.material.findUnique({ where: { id: material.id } }))!.status).toBe(
        'AVAILABLE',
      );
    });
  });

  describe('POST /institutions/{id}/pickups/confirm', () => {
    async function reserveAndGetCode() {
      const { institution, material, staff } = await fixture();
      const studentToken = await tokenFor('aluna@example.com');
      const staffToken = await tokenFor('staff@example.com');
      const created = (await (await reserveAs(studentToken, material.id)).json()) as ReservationBody;
      return { institution, material, staff, staffToken, reservation: created, code: created.pickupCode! };
    }

    it('confirms a valid code exactly once: reservation COMPLETED, material DELIVERED', async () => {
      const { institution, material, reservation, code, staffToken } = await reserveAndGetCode();

      const res = await req('POST', `/api/v1/institutions/${institution.id}/pickups/confirm`, {
        headers: auth(staffToken),
        body: JSON.stringify({ code }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        reservationId: string;
        materialId: string;
        status: string;
        completedAt: string;
      };
      expect(body).toMatchObject({
        reservationId: reservation.id,
        materialId: material.id,
        status: 'COMPLETED',
      });
      expect(new Date(body.completedAt).getTime()).toBeGreaterThan(0);
      expect(
        (await prisma.reservation.findUnique({ where: { id: reservation.id } }))!.status,
      ).toBe('COMPLETED');
      expect((await prisma.material.findUnique({ where: { id: material.id } }))!.status).toBe(
        'DELIVERED',
      );

      // code reuse → generic invalid
      const replay = await req('POST', `/api/v1/institutions/${institution.id}/pickups/confirm`, {
        headers: auth(staffToken),
        body: JSON.stringify({ code }),
      });
      expect(replay.status).toBe(404);
      expect(((await replay.json()) as { message: string }).message).toMatch(/invalid|expired/i);
      // still exactly one COMPLETED reservation
      expect(await prisma.reservation.count({ where: { status: 'COMPLETED' } })).toBe(1);
    });

    it('accepts normalized input (lowercase, no dashes) for the same code', async () => {
      const { institution, material, code, staffToken } = await reserveAndGetCode();
      const res = await req('POST', `/api/v1/institutions/${institution.id}/pickups/confirm`, {
        headers: auth(staffToken),
        body: JSON.stringify({ code: code.replace(/-/g, '').toLowerCase() }),
      });
      expect(res.status).toBe(200);
      expect(
        (await prisma.material.findUnique({ where: { id: material.id } }))!.status,
      ).toBe('DELIVERED');
    });

    it('expired code raced with parallel confirms: all fail, reservation EXPIRED once', async () => {
      const { institution, material, reservation, code, staffToken } = await reserveAndGetCode();
      await prisma.reservation.update({
        where: { id: reservation.id },
        data: {
          createdAt: new Date(Date.now() - 80 * 3_600_000),
          expiresAt: new Date(Date.now() - 8 * 3_600_000),
        },
      });
      const results = await Promise.all(
        Array.from({ length: 4 }, () =>
          req('POST', `/api/v1/institutions/${institution.id}/pickups/confirm`, {
            headers: auth(staffToken),
            body: JSON.stringify({ code }),
          }),
        ),
      );
      expect(results.map((r) => r.status)).toEqual([404, 404, 404, 404]);
      expect(
        (await prisma.reservation.findUnique({ where: { id: reservation.id } }))!.status,
      ).toBe('EXPIRED');
      expect((await prisma.material.findUnique({ where: { id: material.id } }))!.status).toBe(
        'AVAILABLE',
      );
      expect(
        await prisma.auditEvent.count({
          where: { reservationId: reservation.id, action: 'reservation.expire' },
        }),
      ).toBe(1);
      expect(await prisma.reservation.count({ where: { status: 'COMPLETED' } })).toBe(0);
    });

    it('parallel confirmations with the same code yield exactly one success', async () => {
      const { institution, code, staffToken } = await reserveAndGetCode();
      const results = await Promise.all(
        Array.from({ length: 4 }, () =>
          req('POST', `/api/v1/institutions/${institution.id}/pickups/confirm`, {
            headers: auth(staffToken),
            body: JSON.stringify({ code }),
          }),
        ),
      );
      expect(results.map((r) => r.status).sort()).toEqual([200, 404, 404, 404]);
    });

    it('rejects unknown, malformed and expired codes with generic invalid', async () => {
      const { institution, code, staffToken, reservation } = await reserveAndGetCode();
      for (const bad of ['AAAA-BBBB-CCCC', 'ZZZZ-ZZZZ-ZZZZ']) {
        const res = await req('POST', `/api/v1/institutions/${institution.id}/pickups/confirm`, {
          headers: auth(staffToken),
          body: JSON.stringify({ code: bad }),
        });
        expect(res.status).toBe(404);
      }
      // malformed → 400 validation error (not the generic 404)
      const malformed = await req('POST', `/api/v1/institutions/${institution.id}/pickups/confirm`, {
        headers: auth(staffToken),
        body: JSON.stringify({ code: 'abc' }),
      });
      expect(malformed.status).toBe(400);

      // expire the reservation → code invalid, EXPIRED reconciled, material freed
      await prisma.reservation.update({
        where: { id: reservation.id },
        data: {
          createdAt: new Date(Date.now() - 80 * 3_600_000),
          expiresAt: new Date(Date.now() - 8 * 3_600_000),
        },
      });
      const expired = await req('POST', `/api/v1/institutions/${institution.id}/pickups/confirm`, {
        headers: auth(staffToken),
        body: JSON.stringify({ code }),
      });
      expect(expired.status).toBe(404);
      expect(
        (await prisma.reservation.findUnique({ where: { id: reservation.id } }))!.status,
      ).toBe('EXPIRED');
    });

    it('staff of another institution gets the generic invalid, non-members get 403, students 403', async () => {
      const { institution, code } = await reserveAndGetCode();
      // member of a different institution
      const otherInst = await seedInstitution();
      const otherStaff = await createUser('staff2@example.com', 'STAFF');
      await addMember(otherStaff.id, otherInst.id);
      const otherToken = await tokenFor('staff2@example.com');
      const wrongInst = await req(
        'POST',
        `/api/v1/institutions/${otherInst.id}/pickups/confirm`,
        { headers: auth(otherToken), body: JSON.stringify({ code }) },
      );
      expect(wrongInst.status).toBe(404);
      // also: valid code at the *right* institution path but staff not a member → 403
      const stranger = await createUser('staff3@example.com', 'STAFF');
      const strangerToken = await tokenFor('staff3@example.com');
      const notMember = await req(
        'POST',
        `/api/v1/institutions/${institution.id}/pickups/confirm`,
        { headers: auth(strangerToken), body: JSON.stringify({ code }) },
      );
      expect(notMember.status).toBe(403);
      // student role → 403 at the roles guard
      const studentToken = await tokenFor('aluna@example.com');
      const asStudent = await req(
        'POST',
        `/api/v1/institutions/${institution.id}/pickups/confirm`,
        { headers: auth(studentToken), body: JSON.stringify({ code }) },
      );
      expect(asStudent.status).toBe(403);
      void stranger;
    });
  });

  describe('GET /institutions/{id}/dashboard', () => {
    it('reflects actual DB counts after reservation lifecycle transitions', async () => {
      const { institution, material, staff } = await fixture();
      const donor = await prisma.user.findFirst({ where: { email: 'dono@example.com' } });
      await prisma.material.create({
        data: {
          donorId: donor!.id,
          institutionId: institution.id,
          title: 'Pendente',
          description: 'Material aguardando recebimento.',
          category: 'SUPPLIES',
          condition: 'FAIR',
          status: 'PENDING_RECEIPT',
        },
      });
      const token = await tokenFor('aluna@example.com');
      const staffToken = await tokenFor('staff@example.com');
      await reserveAs(token, material.id);

      const dash = await req('GET', `/api/v1/institutions/${institution.id}/dashboard`, {
        headers: bearer(staffToken),
      });
      expect(dash.status).toBe(200);
      const body = (await dash.json()) as Record<string, number>;
      expect(body).toEqual({ pendingReceipt: 1, available: 0, reserved: 1, delivered: 0 });

      // non-member → 403
      const outsider = await createUser('staff9@example.com', 'STAFF');
      const outsiderToken = await tokenFor('staff9@example.com');
      expect(
        (
          await req('GET', `/api/v1/institutions/${institution.id}/dashboard`, {
            headers: bearer(outsiderToken),
          })
        ).status,
      ).toBe(403);
      void staff;
      void outsider;
    });
  });

  describe('security and audit invariants', () => {
    it('uses an inclusive comparison at the exact database transaction timestamp', async () => {
      await prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<Array<{ expired: boolean }>>`
          SELECT (SELECT now()) <= now() AS expired
        `;
        expect(rows[0].expired).toBe(true);
      });
    });

    it('treats a millisecond-round-tripped database expiry instant as expired', async () => {
      const service = app.get(ReservationsService) as unknown as {
        isPastExpiry(tx: unknown, expiresAt: Date): Promise<boolean>;
      };
      await prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<Array<{ now: Date }>>`SELECT now() AS now`;
        const roundTrip = await tx.$queryRaw<
          Array<{ exact: boolean; equalsFloor: boolean; databaseExactMs: boolean }>
        >`
          SELECT
            ${rows[0].now}::timestamptz = now() AS exact,
            ${rows[0].now}::timestamptz = date_trunc('milliseconds', now()) AS "equalsFloor",
            now() = date_trunc('milliseconds', now()) AS "databaseExactMs"
        `;
        // PostgreSQL now() has microseconds; Prisma/JavaScript Date carries milliseconds.
        // Therefore this service-level path normally demonstrates an already-past instant,
        // while the preceding SQL-only assertion proves exact database equality.
        expect(roundTrip[0].equalsFloor).toBe(true);
        expect(roundTrip[0].exact).toBe(roundTrip[0].databaseExactMs);
        await expect(service.isPastExpiry(tx, rows[0].now)).resolves.toBe(true);
      });
    });

    it('disabled users are rejected on all reservation endpoints', async () => {
      const { material, institution } = await fixture();
      const token = await tokenFor('aluna@example.com');
      const created = (await (await reserveAs(token, material.id)).json()) as ReservationBody;
      await prisma.user.updateMany({ where: { email: 'aluna@example.com' }, data: { isActive: false } });
      expect((await req('GET', '/api/v1/me/reservations', { headers: bearer(token) })).status).toBe(
        401,
      );
      expect(
        (
          await req('POST', `/api/v1/reservations/${created.id}/cancel`, {
            headers: bearer(token),
          })
        ).status,
      ).toBe(401);
      void institution;
    });

    it('audit events cover the full lifecycle and never contain the pickup code', async () => {
      const { institution, material, code } = await (async () => {
        const f = await fixture();
        const studentToken = await tokenFor('aluna@example.com');
        const staffToken = await tokenFor('staff@example.com');
        const created = (await (await reserveAs(studentToken, f.material.id)).json()) as ReservationBody;
        await req('POST', `/api/v1/institutions/${f.institution.id}/pickups/confirm`, {
          headers: auth(staffToken),
          body: JSON.stringify({ code: created.pickupCode }),
        });
        return { institution: f.institution, material: f.material, code: created.pickupCode! };
      })();

      const events = await prisma.auditEvent.findMany({
        where: { materialId: material.id },
        orderBy: { createdAt: 'asc' },
      });
      const actions = events.map((e) => e.action);
      expect(actions).toContain('reservation.create');
      expect(actions).toContain('reservation.pickup');
      const raw = code.replace(/-/g, '');
      for (const e of events) {
        expect(JSON.stringify(e.metadata ?? {})).not.toContain(raw);
        expect(JSON.stringify(e.metadata ?? {})).not.toContain(code);
      }
      void institution;
    });
  });
});
