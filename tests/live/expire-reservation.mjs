import { createBackendPrisma } from './backend-prisma.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Test-only helper used by the local SH-02 harness. The id is bound as a
// parameter by Prisma's tagged-template SQL; no interpolated raw SQL is used.
export async function expireReservationForHarness({
  databaseUrl,
  reservationId,
  createClient = createBackendPrisma,
}) {
  if (!UUID.test(reservationId)) throw new Error('reservationId must be a UUID');
  const prisma = createClient(databaseUrl);
  try {
    return await prisma.$executeRaw`
      UPDATE reservations
      SET created_at = now() - interval '73 hours',
          expires_at = now() - interval '1 hour'
      WHERE id = CAST(${reservationId} AS uuid)`;
  } finally {
    await prisma.$disconnect();
  }
}
