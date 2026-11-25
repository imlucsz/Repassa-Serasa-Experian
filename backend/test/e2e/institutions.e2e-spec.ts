import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { PrismaClient } from '@prisma/client';
import { startTestApp } from '../helpers/test-app';
import { truncateAll } from '../helpers/test-db';
import { hashPassword } from '../../src/common/crypto/password';

const JSON_HEADERS = { 'x-repassa-request': '1', 'content-type': 'application/json' };
const PASSWORD = 'senha-de-teste-123';

interface InstitutionItem {
  id: string;
  name: string;
  publicAddress: string;
  pickupInstructions: string;
}

interface PageBody {
  items: InstitutionItem[];
  page: number;
  pageSize: number;
  total: number;
}

describe('Institutions endpoints (e2e, real Postgres)', () => {
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

  async function createUser(
    email: string,
    role: 'STUDENT' | 'STAFF',
  ): Promise<{ id: string }> {
    return prisma.user.create({
      data: {
        email,
        displayName: 'Pessoa Teste',
        passwordHash: await hashPassword(PASSWORD),
        role,
      },
      select: { id: true },
    });
  }

  async function accessTokenFor(email: string): Promise<string> {
    const res = await req('POST', '/api/v1/auth/login', {
      headers: JSON_HEADERS,
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    expect(res.status).toBe(200);
    return ((await res.json()) as { accessToken: string }).accessToken;
  }

  async function seedInstitutions() {
    const activeA = await prisma.institution.create({
      data: {
        name: 'Instituto Zeta (fictício)',
        publicAddress: 'Av. Z, 10 — fictício',
        pickupInstructions: 'Balcão A',
        status: 'APPROVED',
      },
    });
    const activeB = await prisma.institution.create({
      data: {
        name: 'Instituto Alfa (fictício)',
        publicAddress: 'Av. A, 20 — fictício',
        pickupInstructions: 'Balcão B',
        status: 'APPROVED',
      },
    });
    const inactive = await prisma.institution.create({
      data: {
        name: 'Instituto Fechado (fictício)',
        publicAddress: 'Av. F, 30 — fictício',
        pickupInstructions: 'Fechado',
        status: 'APPROVED',
        isActive: false,
      },
    });
    return { activeA, activeB, inactive };
  }

  describe('GET /institutions (public)', () => {
    it('returns only active institutions in the contract page shape', async () => {
      await seedInstitutions();
      const res = await req('GET', '/api/v1/institutions');
      expect(res.status).toBe(200);
      const body = (await res.json()) as PageBody;
      expect(body.total).toBe(2);
      expect(body.page).toBe(1);
      expect(body.pageSize).toBe(20);
      expect(body.items.map((i) => i.name)).toEqual([
        'Instituto Alfa (fictício)',
        'Instituto Zeta (fictício)',
      ]); // name asc
      expect(Object.keys(body.items[0]).sort()).toEqual([
        'id',
        'name',
        'pickupInstructions',
        'publicAddress',
      ]);
    });

    it('paginates within contract limits', async () => {
      await seedInstitutions();
      const page1 = (await (await req('GET', '/api/v1/institutions?page=1&pageSize=1')).json()) as PageBody;
      expect(page1.items).toHaveLength(1);
      expect(page1.total).toBe(2);
      const page2 = (await (await req('GET', '/api/v1/institutions?page=2&pageSize=1')).json()) as PageBody;
      expect(page2.items).toHaveLength(1);
      expect(page2.items[0].name).not.toBe(page1.items[0].name);

      for (const q of ['page=0', 'pageSize=0', 'pageSize=51', 'page=abc', 'pageSize=x']) {
        const res = await req('GET', `/api/v1/institutions?${q}`);
        expect(res.status).toBe(400);
        expect(((await res.json()) as { code: string }).code).toBe('VALIDATION_ERROR');
      }
    });

    it('returns an empty page when nothing is active', async () => {
      const res = await req('GET', '/api/v1/institutions');
      const body = (await res.json()) as PageBody;
      expect(body).toEqual({ items: [], page: 1, pageSize: 20, total: 0 });
    });
  });

  describe('GET /me/institutions (staff)', () => {
    it('requires authentication', async () => {
      expect((await req('GET', '/api/v1/me/institutions')).status).toBe(401);
    });

    it('rejects STUDENT callers with 403', async () => {
      const student = await createUser('aluno@example.com', 'STUDENT');
      await prisma.user.update({ where: { id: student.id }, data: {} }); // touch
      const token = await accessTokenFor('aluno@example.com');
      const res = await req('GET', '/api/v1/me/institutions', {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(403);
      expect(((await res.json()) as { code: string }).code).toBe('FORBIDDEN');
    });

    it('returns only the institutions the staff member belongs to', async () => {
      const { activeA, activeB, inactive } = await seedInstitutions();
      const staffA = await createUser('staff.a@example.com', 'STAFF');
      const staffB = await createUser('staff.b@example.com', 'STAFF');
      await prisma.membership.create({
        data: { userId: staffA.id, institutionId: activeA.id },
      });
      // Staff A also belongs to an inactive institution — must be filtered out.
      await prisma.membership.create({
        data: { userId: staffA.id, institutionId: inactive.id },
      });
      await prisma.membership.create({
        data: { userId: staffB.id, institutionId: activeB.id },
      });

      const tokenA = await accessTokenFor('staff.a@example.com');
      const resA = await req('GET', '/api/v1/me/institutions', {
        headers: { authorization: `Bearer ${tokenA}` },
      });
      expect(resA.status).toBe(200);
      const pageA = (await resA.json()) as PageBody;
      expect(pageA.total).toBe(1);
      expect(pageA.items.map((i) => i.id)).toEqual([activeA.id]);

      // Cross-institution isolation: staff B cannot see institution A.
      const tokenB = await accessTokenFor('staff.b@example.com');
      const resB = await req('GET', '/api/v1/me/institutions', {
        headers: { authorization: `Bearer ${tokenB}` },
      });
      const pageB = (await resB.json()) as PageBody;
      expect(pageB.total).toBe(1);
      expect(pageB.items.map((i) => i.id)).toEqual([activeB.id]);
      expect(pageB.items.map((i) => i.id)).not.toContain(activeA.id);
    });
  });
});
