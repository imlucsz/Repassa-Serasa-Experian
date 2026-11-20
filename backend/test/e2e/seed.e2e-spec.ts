import { PrismaClient } from '@prisma/client';
import { runSeed } from '../../prisma/seed';
import { truncateAll } from '../helpers/test-db';

describe('Seed (real disposable PostgreSQL)', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates synthetic demo data and is idempotent on re-run', async () => {
    await runSeed(prisma);
    const first = await counts(prisma);
    expect(first).toEqual({ institutions: 2, users: 4, memberships: 2, materials: 6 });

    await runSeed(prisma); // second run must not duplicate
    const second = await counts(prisma);
    expect(second).toEqual(first);
  });

  it('seeds staff with membership and students without', async () => {
    await runSeed(prisma);
    const staff = await prisma.user.findMany({ where: { role: 'STAFF' } });
    const memberships = await prisma.membership.findMany();
    expect(staff).toHaveLength(2);
    expect(new Set(memberships.map((m) => m.userId))).toEqual(
      new Set(staff.map((s) => s.id)),
    );
    const students = await prisma.user.findMany({ where: { role: 'STUDENT' } });
    expect(students).toHaveLength(2);
  });

  it('refuses to run in production', async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await expect(runSeed(prisma)).rejects.toThrow('production');
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});

async function counts(prisma: PrismaClient) {
  const [institutions, users, memberships, materials] = await prisma.$transaction([
    prisma.institution.count(),
    prisma.user.count(),
    prisma.membership.count(),
    prisma.material.count(),
  ]);
  return { institutions, users, memberships, materials };
}
