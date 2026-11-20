import { PrismaClient } from '@prisma/client';

const TABLES = [
  'uploads',
  'audit_events',
  'refresh_sessions',
  'reservations',
  'materials',
  'memberships',
  'institutions',
  'users',
];

/** Empties all application tables between tests. */
export async function truncateAll(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(',')} RESTART IDENTITY CASCADE`,
  );
}
