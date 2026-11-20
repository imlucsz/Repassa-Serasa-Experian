import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

export interface ExpiryScope {
  materialId?: string;
  institutionId?: string;
  studentId?: string;
}

interface ExpiredRow {
  id: string;
  materialId: string;
  institutionId: string;
}

/**
 * Expiry reconciliation (BUSINESS_RULES.md): reservations whose server-side
 * expiresAt has passed are terminated EXPIRED and their RESERVED materials
 * return to AVAILABLE in the same transaction. Called before every read that
 * depends on availability and inside every reservation mutation.
 *
 * Lock order is always material row(s) first, then reservation row(s) — the
 * documented global ordering that keeps this safe alongside reserve/cancel/
 * pickup mutations on other connections.
 */
@Injectable()
export class ReservationExpiryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Expires every overdue ACTIVE reservation within `scope`. Returns count. */
  async reconcileExpired(scope: ExpiryScope = {}): Promise<number> {
    // Cheap candidate scan (no locks) — races are re-checked under lock.
    const candidates = await this.prisma.reservation.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { lte: new Date() },
        ...(scope.materialId ? { materialId: scope.materialId } : {}),
        ...(scope.studentId ? { studentId: scope.studentId } : {}),
        ...(scope.institutionId ? { material: { institutionId: scope.institutionId } } : {}),
      },
      select: { id: true, materialId: true },
    });
    if (candidates.length === 0) return 0;

    const materialIds = [...new Set(candidates.map((c) => c.materialId))];
    const ids = candidates.map((c) => c.id);

    return this.prisma.$transaction(async (tx) => {
      // Material rows first (documented lock order), then reservation rows.
      await tx.$queryRaw`
        SELECT id FROM materials
        WHERE id IN (${Prisma.join(materialIds.map((id) => Prisma.sql`${id}::uuid`))})
        FOR UPDATE`;
      const rows = await tx.$queryRaw<ExpiredRow[]>`
        SELECT r.id,
               r.material_id AS "materialId",
               m.institution_id AS "institutionId"
          FROM reservations r
          JOIN materials m ON m.id = r.material_id
         WHERE r.id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
           AND r.status = 'ACTIVE'
           AND r.expires_at <= now()
         FOR UPDATE OF r`;
      if (rows.length === 0) return 0;

      await tx.$executeRaw`
        UPDATE reservations
           SET status = 'EXPIRED', updated_at = now()
         WHERE id IN (${Prisma.join(rows.map((r) => Prisma.sql`${r.id}::uuid`))})`;
      await tx.$executeRaw`
        UPDATE materials
           SET status = 'AVAILABLE', updated_at = now()
         WHERE status = 'RESERVED'
           AND id IN (${Prisma.join(rows.map((r) => Prisma.sql`${r.materialId}::uuid`))})`;
      await tx.auditEvent.createMany({
        data: rows.map((r) => ({
          action: 'reservation.expire',
          reservationId: r.id,
          materialId: r.materialId,
          institutionId: r.institutionId,
        })),
      });
      return rows.length;
    });
  }
}
