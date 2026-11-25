import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import { startTestApp } from '../helpers/test-app';
import { truncateAll } from '../helpers/test-db';
import { hashPassword } from '../../src/common/crypto/password';

const JSON_HEADERS = { 'x-repassa-request': '1', 'content-type': 'application/json' };
const PASSWORD = 'senha-de-teste-123';

interface ManagedMaterial {
  id: string;
  title: string;
  description: string;
  category: string;
  condition: string;
  imageUrl: string | null;
  institution: { id: string; name: string; publicAddress: string; pickupInstructions: string };
  status: string;
  createdAt: string;
  receivedAt: string | null;
  rejectReason: string | null;
  updatedAt: string;
}

interface ManagedPage {
  items: ManagedMaterial[];
  page: number;
  pageSize: number;
  total: number;
}

async function png(): Promise<Buffer> {
  return sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 5, g: 5, b: 5 } } })
    .png()
    .toBuffer();
}

describe('Donations, stock and public catalog (e2e, real Postgres)', () => {
  let app: NestFastifyApplication;
  let baseUrl: string;
  let prisma: PrismaClient;
  let uploadDir: string;

  beforeAll(async () => {
    uploadDir = mkdtempSync(join(tmpdir(), 'repassa-uploads-'));
    process.env.UPLOAD_DIR = uploadDir;
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
    rmSync(uploadDir, { recursive: true, force: true });
    delete process.env.UPLOAD_DIR;
  });

  function req(
    method: string,
    path: string,
    init?: { headers?: Record<string, string>; body?: string | FormData },
  ): Promise<Response> {
    return fetch(`${baseUrl}${path}`, {
      method,
      ...init,
      headers: { connection: 'close', ...init?.headers },
    });
  }

  async function createUser(email: string, role: 'STUDENT' | 'STAFF') {
    return prisma.user.create({
      data: { email, displayName: 'Pessoa Teste', passwordHash: await hashPassword(PASSWORD), role },
      select: { id: true },
    });
  }

  async function tokenFor(email: string): Promise<string> {
    const res = await req('POST', '/api/v1/auth/login', {
      headers: JSON_HEADERS,
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    expect(res.status).toBe(200);
    return ((await res.json()) as { accessToken: string }).accessToken;
  }

  const auth = (token: string) => ({ ...JSON_HEADERS, authorization: `Bearer ${token}` });
  // POSTs without a JSON body must not declare content-type (Fastify rejects empty JSON bodies).
  const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

  async function seedInstitution(name = 'Instituto Central (fictício)', isActive = true) {
    return prisma.institution.create({
      data: {
        name,
        publicAddress: 'Av. C, 100 — fictício',
        pickupInstructions: 'Balcão principal',
        status: 'APPROVED',
        isActive,
      },
    });
  }

  async function donate(token: string, institutionId: string, extra: object = {}) {
    return req('POST', '/api/v1/donations', {
      headers: auth(token),
      body: JSON.stringify({
        title: 'Livro de Cálculo I',
        description: 'Edição usada em bom estado, sem anotações.',
        category: 'BOOK',
        condition: 'GOOD',
        institutionId,
        ...extra,
      }),
    });
  }

  async function seedMaterial(
    donorId: string,
    institutionId: string,
    status: 'PENDING_RECEIPT' | 'AVAILABLE' | 'RESERVED' = 'PENDING_RECEIPT',
    title = 'Apostila de Física',
  ) {
    return prisma.material.create({
      data: {
        donorId,
        institutionId,
        title,
        description: 'Material didático em bom estado.',
        category: 'BOOK',
        condition: 'GOOD',
        status,
        ...(status !== 'PENDING_RECEIPT' ? { receivedAt: new Date() } : {}),
      },
    });
  }

  describe('POST /donations', () => {
    it('creates a PENDING_RECEIPT material for the student (ManagedMaterial shape, no donor PII)', async () => {
      const donor = await createUser('dono@example.com', 'STUDENT');
      const inst = await seedInstitution();
      const token = await tokenFor('dono@example.com');

      const res = await donate(token, inst.id);
      expect(res.status).toBe(201);
      const body = (await res.json()) as ManagedMaterial;
      expect(body.status).toBe('PENDING_RECEIPT');
      expect(body.receivedAt).toBeNull();
      expect(body.rejectReason).toBeNull();
      expect(body.imageUrl).toBeNull();
      expect(body.institution.id).toBe(inst.id);
      expect(Object.keys(body).sort()).toEqual(
        ['id', 'title', 'description', 'category', 'condition', 'imageUrl', 'institution', 'status', 'createdAt', 'receivedAt', 'rejectReason', 'updatedAt'].sort(),
      );

      const row = await prisma.material.findUniqueOrThrow({ where: { id: body.id } });
      expect(row.donorId).toBe(donor.id);
      const audit = await prisma.auditEvent.findFirst({
        where: { materialId: body.id, action: 'material.donate' },
      });
      expect(audit?.actorId).toBe(donor.id);
    });

    it('consumes an own upload and rejects reuse / foreign uploads', async () => {
      const donor = await createUser('dono2@example.com', 'STUDENT');
      const other = await createUser('outro@example.com', 'STUDENT');
      const inst = await seedInstitution();
      const token = await tokenFor('dono2@example.com');
      const otherToken = await tokenFor('outro@example.com');

      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(await png())], { type: 'image/png' }), 'f.png');
      const up = await req('POST', '/api/v1/uploads', {
        headers: { authorization: `Bearer ${otherToken}` },
        body: form,
      });
      const { uploadId } = (await up.json()) as { uploadId: string };

      // Not the donor's upload -> 400 validation.
      expect((await donate(token, inst.id, { uploadId })).status).toBe(400);

      // Own upload path: create a fresh upload owned by the donor.
      const ownForm = new FormData();
      ownForm.append('file', new Blob([new Uint8Array(await png())], { type: 'image/png' }), 'f.png');
      const own = await req('POST', '/api/v1/uploads', {
        headers: { authorization: `Bearer ${token}` },
        body: ownForm,
      });
      const { uploadId: ownUpload } = (await own.json()) as { uploadId: string };
      const created = await donate(token, inst.id, { uploadId: ownUpload });
      expect(created.status).toBe(201);
      expect((await prisma.upload.findUniqueOrThrow({ where: { id: ownUpload } })).consumedAt).not.toBeNull();

      // Reusing the same upload fails — one upload binds to one material.
      expect((await donate(token, inst.id, { uploadId: ownUpload })).status).toBe(400);
      void other;
    });

    it('rejects inactive or unknown institution and malformed payloads', async () => {
      await createUser('dono3@example.com', 'STUDENT');
      const inst = await seedInstitution('Instituto Fechado (fictício)', false);
      const token = await tokenFor('dono3@example.com');

      expect((await donate(token, inst.id)).status).toBe(400);
      expect((await donate(token, crypto.randomUUID())).status).toBe(400);
      expect((await donate(token, 'not-a-uuid')).status).toBe(400);
      // privilege/status injection fields
      const res = await req('POST', '/api/v1/donations', {
        headers: auth(token),
        body: JSON.stringify({
          title: 'Livro Xpto',
          description: 'Descrição suficiente para passar.',
          category: 'BOOK',
          condition: 'GOOD',
          institutionId: inst.id,
          status: 'AVAILABLE',
          donorId: crypto.randomUUID(),
        }),
      });
      expect(res.status).toBe(400);
    });

    it('requires STUDENT role — staff gets 403, anonymous 401', async () => {
      await createUser('func@example.com', 'STAFF');
      const inst = await seedInstitution();
      const staffToken = await tokenFor('func@example.com');
      expect((await donate(staffToken, inst.id)).status).toBe(403);
      expect((await donate('', inst.id)).status).toBe(401);
    });
  });

  describe('GET /me/donations', () => {
    it('lists only the caller\'s materials with status filter', async () => {
      const donor = await createUser('hist@example.com', 'STUDENT');
      const other = await createUser('alheio@example.com', 'STUDENT');
      const inst = await seedInstitution();
      const token = await tokenFor('hist@example.com');

      await seedMaterial(donor.id, inst.id, 'PENDING_RECEIPT', 'Caderno A');
      await seedMaterial(donor.id, inst.id, 'AVAILABLE', 'Caderno B');
      await seedMaterial(other.id, inst.id, 'PENDING_RECEIPT', 'Caderno alheio');

      const res = await req('GET', '/api/v1/me/donations', { headers: auth(token) });
      expect(res.status).toBe(200);
      const page = (await res.json()) as ManagedPage;
      expect(page.total).toBe(2);
      expect(page.items.map((i) => i.title).sort()).toEqual(['Caderno A', 'Caderno B']);
      expect(page.items[0].status).toBeDefined();

      const filtered = (await (
        await req('GET', '/api/v1/me/donations?status=AVAILABLE', { headers: auth(token) })
      ).json()) as ManagedPage;
      expect(filtered.total).toBe(1);
      expect(filtered.items[0].title).toBe('Caderno B');
    });
  });

  describe('POST /donations/{id}/cancel', () => {
    it('cancels an own pending donation; wrong owner 404, non-pending 409', async () => {
      const donor = await createUser('cancel@example.com', 'STUDENT');
      const other = await createUser('invasor@example.com', 'STUDENT');
      const inst = await seedInstitution();
      const token = await tokenFor('cancel@example.com');
      const otherToken = await tokenFor('invasor@example.com');

      const pending = await seedMaterial(donor.id, inst.id, 'PENDING_RECEIPT');
      const received = await seedMaterial(donor.id, inst.id, 'AVAILABLE');

      // Not the owner -> hidden resource 404.
      expect(
        (await req('POST', `/api/v1/donations/${pending.id}/cancel`, { headers: bearer(otherToken) })).status,
      ).toBe(404);
      // Non-pending -> 409.
      expect(
        (await req('POST', `/api/v1/donations/${received.id}/cancel`, { headers: bearer(token) })).status,
      ).toBe(409);

      const ok = await req('POST', `/api/v1/donations/${pending.id}/cancel`, { headers: bearer(token) });
      expect(ok.status).toBe(200);
      expect(((await ok.json()) as ManagedMaterial).status).toBe('CANCELED');
      expect((await prisma.material.findUniqueOrThrow({ where: { id: pending.id } })).status).toBe('CANCELED');

      // Second cancel is now a 409 (terminal).
      expect(
        (await req('POST', `/api/v1/donations/${pending.id}/cancel`, { headers: bearer(token) })).status,
      ).toBe(409);
    });
  });

  describe('institution stock inbox (staff)', () => {
    it('requires STAFF membership; cross-tenant list is rejected', async () => {
      const staff = await createUser('membro@example.com', 'STAFF');
      const outsider = await createUser('fora@example.com', 'STAFF');
      const student = await createUser('aluno@example.com', 'STUDENT');
      const inst = await seedInstitution();
      const otherInst = await seedInstitution('Outro Instituto (fictício)');
      await prisma.membership.create({ data: { userId: staff.id, institutionId: inst.id } });

      const memberToken = await tokenFor('membro@example.com');
      const outsiderToken = await tokenFor('fora@example.com');
      const studentToken = await tokenFor('aluno@example.com');

      expect(
        (await req('GET', `/api/v1/institutions/${inst.id}/materials`, { headers: auth(memberToken) })).status,
      ).toBe(200);
      expect(
        (await req('GET', `/api/v1/institutions/${inst.id}/materials`, { headers: auth(outsiderToken) })).status,
      ).toBe(403);
      expect(
        (await req('GET', `/api/v1/institutions/${inst.id}/materials`, { headers: auth(studentToken) })).status,
      ).toBe(403);
      expect((await req('GET', `/api/v1/institutions/${inst.id}/materials`)).status).toBe(401);
      void otherInst;
    });

    it('lists own-institution materials with status/q filters', async () => {
      const donor = await createUser('dono@example.com', 'STUDENT');
      const staff = await createUser('membro@example.com', 'STAFF');
      const inst = await seedInstitution();
      const otherInst = await seedInstitution('Instituto Norte (fictício)');
      await prisma.membership.create({ data: { userId: staff.id, institutionId: inst.id } });
      const token = await tokenFor('membro@example.com');

      await seedMaterial(donor.id, inst.id, 'PENDING_RECEIPT', 'Gramática completa');
      await seedMaterial(donor.id, inst.id, 'AVAILABLE', 'Atlas geográfico');
      await seedMaterial(donor.id, otherInst.id, 'PENDING_RECEIPT', 'Material de outra unidade');

      const page = (await (
        await req('GET', `/api/v1/institutions/${inst.id}/materials`, { headers: auth(token) })
      ).json()) as ManagedPage;
      expect(page.total).toBe(2);
      expect(page.items.every((i) => i.institution.id === inst.id)).toBe(true);

      const pending = (await (
        await req('GET', `/api/v1/institutions/${inst.id}/materials?status=PENDING_RECEIPT`, { headers: auth(token) })
      ).json()) as ManagedPage;
      expect(pending.total).toBe(1);
      expect(pending.items[0].title).toBe('Gramática completa');

      const search = (await (
        await req('GET', `/api/v1/institutions/${inst.id}/materials?q=atlas`, { headers: auth(token) })
      ).json()) as ManagedPage;
      expect(search.total).toBe(1);
    });

    it('receive: pending -> AVAILABLE with actor/timestamp; non-pending 409; cross-tenant 404', async () => {
      const donor = await createUser('dono@example.com', 'STUDENT');
      const staff = await createUser('membro@example.com', 'STAFF');
      const inst = await seedInstitution();
      const otherInst = await seedInstitution('Instituto Sul (fictício)');
      await prisma.membership.create({ data: { userId: staff.id, institutionId: inst.id } });
      const token = await tokenFor('membro@example.com');

      const pending = await seedMaterial(donor.id, inst.id, 'PENDING_RECEIPT');
      const foreign = await seedMaterial(donor.id, otherInst.id, 'PENDING_RECEIPT');

      // Material belongs to another institution -> generic 404, no tenant leak.
      expect(
        (await req('POST', `/api/v1/institutions/${inst.id}/materials/${foreign.id}/receive`, { headers: bearer(token) })).status,
      ).toBe(404);

      const res = await req(
        'POST',
        `/api/v1/institutions/${inst.id}/materials/${pending.id}/receive`,
        { headers: bearer(token) },
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as ManagedMaterial;
      expect(body.status).toBe('AVAILABLE');
      expect(body.receivedAt).not.toBeNull();

      const row = await prisma.material.findUniqueOrThrow({ where: { id: pending.id } });
      expect(row.receivedBy).toBe(staff.id);
      expect(row.receivedAt).not.toBeNull();

      const audit = await prisma.auditEvent.findFirst({
        where: { materialId: pending.id, action: 'material.receive' },
      });
      expect(audit?.actorId).toBe(staff.id);
      expect(audit?.institutionId).toBe(inst.id);

      // Already received -> 409.
      expect(
        (await req('POST', `/api/v1/institutions/${inst.id}/materials/${pending.id}/receive`, { headers: bearer(token) })).status,
      ).toBe(409);
    });

    it('reject: pending -> REJECTED with reason; terminal and validation enforced', async () => {
      const donor = await createUser('dono@example.com', 'STUDENT');
      const staff = await createUser('membro@example.com', 'STAFF');
      const inst = await seedInstitution();
      await prisma.membership.create({ data: { userId: staff.id, institutionId: inst.id } });
      const token = await tokenFor('membro@example.com');
      const pending = await seedMaterial(donor.id, inst.id, 'PENDING_RECEIPT');

      // Reason required.
      expect(
        (await req('POST', `/api/v1/institutions/${inst.id}/materials/${pending.id}/reject`, { headers: auth(token), body: '{}' })).status,
      ).toBe(400);
      expect(
        (await req('POST', `/api/v1/institutions/${inst.id}/materials/${pending.id}/reject`, { headers: auth(token), body: JSON.stringify({ reason: 'ok' }) })).status,
      ).toBe(400);

      const res = await req(
        'POST',
        `/api/v1/institutions/${inst.id}/materials/${pending.id}/reject`,
        { headers: auth(token), body: JSON.stringify({ reason: 'Item não corresponde ao anunciado' }) },
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as ManagedMaterial;
      expect(body.status).toBe('REJECTED');
      expect(body.rejectReason).toBe('Item não corresponde ao anunciado');

      // Terminal -> 409 on further transitions.
      expect(
        (await req('POST', `/api/v1/institutions/${inst.id}/materials/${pending.id}/receive`, { headers: bearer(token) })).status,
      ).toBe(409);
    });

    it('serializes staff receive vs donor cancel — exactly one wins', async () => {
      const donor = await createUser('corrida@example.com', 'STUDENT');
      const staff = await createUser('func@example.com', 'STAFF');
      const inst = await seedInstitution();
      await prisma.membership.create({ data: { userId: staff.id, institutionId: inst.id } });
      const donorToken = await tokenFor('corrida@example.com');
      const staffToken = await tokenFor('func@example.com');
      const pending = await seedMaterial(donor.id, inst.id, 'PENDING_RECEIPT');

      const [cancelRes, receiveRes] = await Promise.all([
        req('POST', `/api/v1/donations/${pending.id}/cancel`, { headers: bearer(donorToken) }),
        req('POST', `/api/v1/institutions/${inst.id}/materials/${pending.id}/receive`, { headers: bearer(staffToken) }),
      ]);
      const statuses = [cancelRes.status, receiveRes.status].sort();
      expect(statuses).toEqual([200, 409]);

      const final = await prisma.material.findUniqueOrThrow({ where: { id: pending.id } });
      expect(['CANCELED', 'AVAILABLE']).toContain(final.status);
      // The winner's status must match the winner's endpoint.
      if (receiveRes.status === 200) expect(final.status).toBe('AVAILABLE');
      else expect(final.status).toBe('CANCELED');
    });
  });

  describe('public catalog', () => {
    it('lists only AVAILABLE materials at active institutions; pending invisible', async () => {
      const donor = await createUser('cat@example.com', 'STUDENT');
      const inst = await seedInstitution();
      const inactive = await seedInstitution('Instituto Inativo (fictício)', false);
      await seedMaterial(donor.id, inst.id, 'PENDING_RECEIPT', 'Livro pendente');
      await seedMaterial(donor.id, inst.id, 'AVAILABLE', 'Livro disponível');
      await seedMaterial(donor.id, inactive.id, 'AVAILABLE', 'Livro de inativa');

      const page = (await (
        await req('GET', '/api/v1/materials')
      ).json()) as { items: { id: string; title: string; status: string }[]; total: number };
      expect(page.total).toBe(1);
      expect(page.items[0].title).toBe('Livro disponível');
      expect(page.items[0].status).toBe('AVAILABLE');
    });

    it('filters by q, category and institutionId', async () => {
      const donor = await createUser('filtro@example.com', 'STUDENT');
      const instA = await seedInstitution('Inst A (fictício)');
      const instB = await seedInstitution('Inst B (fictício)');
      await seedMaterial(donor.id, instA.id, 'AVAILABLE', 'Coleção de poemas');
      await prisma.material.create({
        data: {
          donorId: donor.id,
          institutionId: instB.id,
          title: 'Kit de laboratório',
          description: 'Itens variados',
          category: 'SUPPLIES',
          condition: 'FAIR',
          status: 'AVAILABLE',
          receivedAt: new Date(),
        },
      });

      const q = (await (await req('GET', '/api/v1/materials?q=poemas')).json()) as { total: number };
      expect(q.total).toBe(1);
      const cat = (await (await req('GET', '/api/v1/materials?category=SUPPLIES')).json()) as { total: number; items: { title: string }[] };
      expect(cat.total).toBe(1);
      expect(cat.items[0].title).toBe('Kit de laboratório');
      const byInst = (await (await req('GET', `/api/v1/materials?institutionId=${instA.id}`)).json()) as { total: number };
      expect(byInst.total).toBe(1);
      const badEnum = await req('GET', '/api/v1/materials?category=INVALID');
      expect(badEnum.status).toBe(400);
    });

    it('GET /materials/{id} returns AVAILABLE detail and 404 for pending/unknown', async () => {
      const donor = await createUser('det@example.com', 'STUDENT');
      const inst = await seedInstitution();
      const available = await seedMaterial(donor.id, inst.id, 'AVAILABLE', 'Detalhe público');
      const pending = await seedMaterial(donor.id, inst.id, 'PENDING_RECEIPT', 'Detalhe oculto');

      const res = await req('GET', `/api/v1/materials/${available.id}`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { id: string; status: string; institution: { id: string } };
      expect(body.status).toBe('AVAILABLE');
      expect(body.institution.id).toBe(inst.id);
      expect(Object.keys(body).sort()).toEqual(
        ['id', 'title', 'description', 'category', 'condition', 'imageUrl', 'institution', 'status', 'createdAt'].sort(),
      );

      expect((await req('GET', `/api/v1/materials/${pending.id}`)).status).toBe(404);
      expect((await req('GET', `/api/v1/materials/${crypto.randomUUID()}`)).status).toBe(404);
    });
  });
});
