import { Prisma, PrismaClient } from '@prisma/client';
import { truncateAll } from '../helpers/test-db';

const EXPECTED_TABLES = [
  'users',
  'institutions',
  'memberships',
  'materials',
  'reservations',
  'refresh_sessions',
  'audit_events',
  'uploads',
];

describe('Database schema (real disposable PostgreSQL)', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient();
  });

  afterEach(async () => {
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('applied the init migration', async () => {
    const applied = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`;
    expect(applied.some((r) => r.migration_name.endsWith('_init'))).toBe(true);
  });

  it('created all expected tables', async () => {
    const rows = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`;
    const tables = rows.map((r) => r.table_name);
    for (const table of EXPECTED_TABLES) {
      expect(tables).toContain(table);
    }
  });

  it('created the partial unique index for one live reservation per material', async () => {
    const rows = await prisma.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'reservation_one_active_per_material'`;
    expect(rows).toHaveLength(1);
    expect(rows[0].indexdef).toContain('material_id');
    expect(rows[0].indexdef.toUpperCase()).toContain("WHERE (STATUS = 'ACTIVE'");
  });

  it('enforces at most one ACTIVE reservation per material', async () => {
    const { user, material } = await seedUserInstitutionMaterial(prisma);
    const reservation = {
      materialId: material.id,
      studentId: user.id,
      status: 'ACTIVE' as const,
      codeDigest: 'digest-1',
      expiresAt: new Date(Date.now() + 72 * 3600 * 1000),
    };
    await prisma.reservation.create({ data: reservation });
    await expect(
      prisma.reservation.create({
        data: { ...reservation, codeDigest: 'digest-2' },
      }),
    ).rejects.toThrow(Prisma.PrismaClientKnownRequestError);
    // A second ACTIVE row truly does not exist.
    expect(await prisma.reservation.count({ where: { materialId: material.id } })).toBe(1);
  });

  it('allows a new ACTIVE reservation after the previous one terminates', async () => {
    const { user, material } = await seedUserInstitutionMaterial(prisma);
    await prisma.reservation.create({
      data: {
        materialId: material.id,
        studentId: user.id,
        status: 'CANCELED',
        codeDigest: 'digest-1',
        expiresAt: new Date(Date.now() + 72 * 3600 * 1000),
      },
    });
    const second = await prisma.reservation.create({
      data: {
        materialId: material.id,
        studentId: user.id,
        status: 'ACTIVE',
        codeDigest: 'digest-2',
        expiresAt: new Date(Date.now() + 72 * 3600 * 1000),
      },
    });
    expect(second.status).toBe('ACTIVE');
  });

  it('rejects expires_at not after created_at (check constraint)', async () => {
    const { user, material } = await seedUserInstitutionMaterial(prisma);
    await expect(
      prisma.$executeRaw`
        INSERT INTO reservations (id, material_id, student_id, status, code_digest, expires_at, created_at, updated_at)
        VALUES (gen_random_uuid(), ${material.id}::uuid, ${user.id}::uuid, 'ACTIVE', 'x', now() - interval '1 hour', now(), now())`,
    ).rejects.toThrow();
  });
});

async function seedUserInstitutionMaterial(prisma: PrismaClient) {
  const user = await prisma.user.create({
    data: {
      email: 'student@example.com',
      displayName: 'Test Student',
      passwordHash: 'x'.repeat(60),
      role: 'STUDENT',
    },
  });
  const institution = await prisma.institution.create({
    data: {
      name: 'Instituto de Testes (fictício)',
      publicAddress: 'Rua Fictícia, 1',
      pickupInstructions: 'Balcão 1',
    },
  });
  const material = await prisma.material.create({
    data: {
      donorId: user.id,
      institutionId: institution.id,
      title: 'Livro de teste',
      description: 'Descrição longa o suficiente para o teste.',
      category: 'BOOK',
      condition: 'GOOD',
      status: 'AVAILABLE',
    },
  });
  return { user, institution, material };
}
