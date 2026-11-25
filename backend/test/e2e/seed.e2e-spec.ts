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
    expect(first).toEqual({ institutions: 3, users: 5, memberships: 2, materials: 6, reservations: 1 });

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
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
    expect(admins).toHaveLength(1);
  });

  it('seeds an approved set plus one pending institution for the admin flow', async () => {
    await runSeed(prisma);
    const byStatus = await prisma.institution.groupBy({ by: ['status'], _count: { _all: true } });
    const count = (s: string) => byStatus.find((g) => g.status === s)?._count._all ?? 0;
    expect(count('APPROVED')).toBe(2);
    expect(count('PENDING')).toBe(1);
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
  const [institutions, users, memberships, materials, reservations] = await prisma.$transaction([
    prisma.institution.count(),
    prisma.user.count(),
    prisma.membership.count(),
    prisma.material.count(),
    prisma.reservation.count(),
  ]);
  return { institutions, users, memberships, materials, reservations };
}
