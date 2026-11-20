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

interface ManagedItem {
  id: string;
  status: string;
  imageUrl: string | null;
}

async function png(): Promise<Buffer> {
  return sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 20, g: 80, b: 40 } } })
    .png()
    .toBuffer();
}

async function jpegWithExif(): Promise<Buffer> {
  return sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 10, g: 10, b: 200 } } })
    .jpeg()
    .withMetadata({ orientation: 6, exif: { IFD0: { Copyright: 'sensitive-owner-data' } } })
    .toBuffer();
}

describe('Uploads API (e2e, real Postgres)', () => {
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

  async function upload(token: string, body: Buffer, type = 'image/png', name = 'foto.png') {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(body)], { type }), name);
    return req('POST', '/api/v1/uploads', {
      headers: { authorization: `Bearer ${token}` },
      body: form,
    });
  }

  async function seedInstitution() {
    return prisma.institution.create({
      data: {
        name: 'Instituto Upload (fictício)',
        publicAddress: 'Av. U, 1 — fictício',
        pickupInstructions: 'Balcão',
      },
    });
  }

  describe('POST /uploads', () => {
    it('requires authentication', async () => {
      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(await png())], { type: 'image/png' }), 'x.png');
      expect((await req('POST', '/api/v1/uploads', { body: form })).status).toBe(401);
    });

    it('accepts a PNG, persists an owner-bound Upload row and returns only uploadId', async () => {
      const donor = await createUser('dono@example.com', 'STUDENT');
      const token = await tokenFor('dono@example.com');
      const res = await upload(token, await png());
      expect(res.status).toBe(201);
      const body = (await res.json()) as { uploadId?: string };
      expect(Object.keys(body)).toEqual(['uploadId']);

      const row = await prisma.upload.findUnique({ where: { id: body.uploadId } });
      expect(row?.ownerId).toBe(donor.id);
      expect(row?.contentType).toBe('image/png');
      expect(row?.key).toMatch(/^[0-9a-f-]{36}\.png$/);
      expect(row?.consumedAt).toBeNull();
    });

    it('rejects non-image and oversized payloads', async () => {
      const u = await createUser('ruim@example.com', 'STUDENT');
      const token = await tokenFor('ruim@example.com');

      const svg = await upload(
        token,
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
        'image/svg+xml',
        'x.svg',
      );
      expect(svg.status).toBe(400);

      const fakePng = await upload(token, Buffer.from('not an image at all'), 'image/png', 'x.png');
      expect(fakePng.status).toBe(400);

      const oversized = await upload(
        token,
        Buffer.alloc(5 * 1024 * 1024 + 16, 7),
        'image/png',
        'big.png',
      );
      expect([400, 413]).toContain(oversized.status);
    });

    it('rejects a declared image type that does not match the real bytes', async () => {
      await createUser('spoof@example.com', 'STUDENT');
      const token = await tokenFor('spoof@example.com');
      const res = await upload(token, await png(), 'image/webp', 'x.webp');
      expect(res.status).toBe(400);
    });

    it('strips EXIF/metadata by re-encoding before persistence', async () => {
      await createUser('exif@example.com', 'STUDENT');
      const token = await tokenFor('exif@example.com');
      const source = await jpegWithExif();
      expect((await sharp(source).metadata()).exif).toBeDefined();

      const res = await upload(token, source, 'image/jpeg', 'exif.jpg');
      expect(res.status).toBe(201);
      const { uploadId } = (await res.json()) as { uploadId: string };
      const row = await prisma.upload.findUniqueOrThrow({ where: { id: uploadId } });

      // Serve it back as the owner and verify no metadata survived.
      const served = await req('GET', `/api/v1/uploads/${row.key}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(served.status).toBe(200);
      const servedBuf = Buffer.from(await served.arrayBuffer());
      const meta = await sharp(servedBuf).metadata();
      expect(meta.exif).toBeUndefined();
      expect(meta.orientation).toBeUndefined();
    });
  });

  describe('GET /uploads/:key — private until publicly available', () => {
    it('owner can fetch an unattached upload; others and anonymous get 404', async () => {
      const owner = await createUser('dono2@example.com', 'STUDENT');
      await createUser('outro@example.com', 'STUDENT');
      const ownerToken = await tokenFor('dono2@example.com');
      const otherToken = await tokenFor('outro@example.com');

      const { uploadId } = (await (
        await upload(ownerToken, await png())
      ).json()) as { uploadId: string };
      const row = await prisma.upload.findUniqueOrThrow({ where: { id: uploadId } });

      expect(
        (await req('GET', `/api/v1/uploads/${row.key}`, { headers: { authorization: `Bearer ${ownerToken}` } })).status,
      ).toBe(200);
      expect((await req('GET', `/api/v1/uploads/${row.key}`)).status).toBe(404);
      expect(
        (await req('GET', `/api/v1/uploads/${row.key}`, { headers: { authorization: `Bearer ${otherToken}` } })).status,
      ).toBe(404);
      expect((await req('GET', '/api/v1/uploads/../../../../etc/passwd')).status).toBe(404);
    });

    it('pending material image: donor + member staff only; AVAILABLE: public', async () => {
      const donor = await createUser('dona@example.com', 'STUDENT');
      const staff = await createUser('func@example.com', 'STAFF');
      await createUser('externa@example.com', 'STUDENT');
      const inst = await seedInstitution();
      await prisma.membership.create({ data: { userId: staff.id, institutionId: inst.id } });
      const donorToken = await tokenFor('dona@example.com');
      const staffToken = await tokenFor('func@example.com');
      const otherToken = await tokenFor('externa@example.com');

      const { uploadId } = (await (
        await upload(donorToken, await png())
      ).json()) as { uploadId: string };
      const donation = await req('POST', '/api/v1/donations', {
        headers: { ...JSON_HEADERS, authorization: `Bearer ${donorToken}` },
        body: JSON.stringify({
          title: 'Livro de Cálculo I',
          description: 'Edição usada em bom estado, sem anotações.',
          category: 'BOOK',
          condition: 'GOOD',
          institutionId: inst.id,
          uploadId,
        }),
      });
      expect(donation.status).toBe(201);
      const created = (await donation.json()) as ManagedItem;
      const key = created.imageUrl!.split('/').pop()!;

      const get = (token?: string) =>
        req('GET', `/api/v1/uploads/${key}`, {
          headers: token ? { authorization: `Bearer ${token}` } : {},
        });
      expect((await get()).status).toBe(404); // anonymous: pending is private
      expect((await get(donorToken)).status).toBe(200);
      expect((await get(staffToken)).status).toBe(200);
      expect((await get(otherToken)).status).toBe(404);

      const received = await req(
        'POST',
        `/api/v1/institutions/${inst.id}/materials/${created.id}/receive`,
        { headers: { authorization: `Bearer ${staffToken}` } },
      );
      expect(received.status).toBe(200);
      expect((await get()).status).toBe(200); // now public
      expect((await get()).headers.get('content-type')).toBe('image/png');
    });
  });
});
