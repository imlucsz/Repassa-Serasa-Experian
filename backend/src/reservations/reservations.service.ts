import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { MaterialStatus, ReservationStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { RateLimitService } from '../common/rate-limit/rate-limit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PickupCodeService } from './pickup-code.service';
import { ReservationExpiryService } from './reservation-expiry.service';
import { toReservationDto, type ReservationDto } from './reservation.mapper';
import type { MyReservationsQueryDto } from './dto/reservation.dto';

const NOT_FOUND = 'Not found';
const TRANSITION_CONFLICT = 'Resource state does not allow this action';
const INVALID_CODE = 'Invalid or expired pickup code';
const RESERVATION_TTL_MS = 72 * 60 * 60 * 1000;
const MINUTE_MS = 60_000;
// SECURITY.md proposal: 10/min per staff+institution plus an IP-wide cap.
const PICKUP_PER_STAFF = { limit: 10, windowMs: MINUTE_MS };
const PICKUP_PER_IP = { limit: 60, windowMs: MINUTE_MS };

const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

interface LockedMaterialRow {
  id: string;
  donorId: string;
  institutionId: string;
  institutionIsActive: boolean;
  status: MaterialStatus;
}

interface LockedReservationRow {
  id: string;
  materialId: string;
  studentId: string;
  status: ReservationStatus;
  expiresAt: Date;
}

interface ReservationPage {
  items: ReservationDto[];
  page: number;
  pageSize: number;
  total: number;
}

export interface DashboardDto {
  pendingReceipt: number;
  available: number;
  reserved: number;
  delivered: number;
}

export interface PickupResultDto {
  reservationId: string;
  materialId: string;
  status: 'COMPLETED';
  completedAt: string;
}

const RESERVATION_INCLUDE = { material: { include: { institution: true } } } as const;

/**
 * Reservation + pickup lifecycle (BUSINESS_RULES.md). Every mutation locks the
 * material row first, then the reservation row, re-reads state and DB time
 * under lock, and commits state + audit atomically. The partial unique index
 * on reservations(material_id) WHERE status='ACTIVE' is the database backstop.
 */
@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codes: PickupCodeService,
    private readonly expiry: ReservationExpiryService,
    private readonly rateLimit: RateLimitService,
  ) {}

  /**
   * Student reservation: AVAILABLE → RESERVED with a 72h expiry. Concurrent
   * attempts serialize on the material row lock; a live reservation (or any
   * non-available state) is a 409, a non-existent/non-visible material a 404.
   * The donor cannot reserve their own material.
   */
  async reserve(user: AuthenticatedUser, materialId: string): Promise<ReservationDto> {
    const created = await this.prisma.$transaction(async (tx) => {
      const row = await this.lockMaterial(tx, materialId);
      if (!row || !row.institutionIsActive) throw new NotFoundException(NOT_FOUND);
      if (row.donorId === user.id) {
        throw new ForbiddenException('Donors cannot reserve their own donation');
      }

      // Reconcile this material's stale reservation first (material lock held).
      await this.expireStaleForMaterial(tx, row.id);
      const live = await tx.reservation.findFirst({
        where: { materialId: row.id, status: 'ACTIVE' },
        select: { id: true },
      });
      if (live) throw new ConflictException(TRANSITION_CONFLICT);
      // RESERVED without a live reservation means it was just expired above —
      // effectively available again. Other non-available states stay invisible.
      if (row.status !== 'AVAILABLE' && row.status !== 'RESERVED') {
        throw new NotFoundException(NOT_FOUND);
      }

      const reservation = await this.createReservationWithRetry(tx, row.id, user.id);
      await tx.material.update({ where: { id: row.id }, data: { status: 'RESERVED' } });
      await tx.auditEvent.create({
        data: {
          actorId: user.id,
          institutionId: row.institutionId,
          materialId: row.id,
          reservationId: reservation.id,
          action: 'reservation.create',
          metadata: { expiresAt: reservation.expiresAt.toISOString() },
        },
      });
      return reservation;
    });
    return toReservationDto(created, this.codes);
  }

  /** Student history — own reservations; stale ones reconciled first. */
  async listMine(user: AuthenticatedUser, query: MyReservationsQueryDto): Promise<ReservationPage> {
    await this.expiry.reconcileExpired({ studentId: user.id });
    const where: Prisma.ReservationWhereInput = {
      studentId: user.id,
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.reservation.findMany({
        where,
        include: RESERVATION_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.reservation.count({ where }),
    ]);
    return {
      items: items.map((r) => toReservationDto(r, this.codes)),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  /**
   * Owner cancellation: ACTIVE+unexpired only → CANCELED, material back to
   * AVAILABLE. Unknown/non-owned ids are generic 404s; repeated or invalid
   * transitions are 409 (BUSINESS_RULES).
   */
  async cancel(user: AuthenticatedUser, reservationId: string): Promise<ReservationDto> {
    const pointer = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { materialId: true, studentId: true },
    });
    if (!pointer || pointer.studentId !== user.id) throw new NotFoundException(NOT_FOUND);

    const outcome = await this.prisma.$transaction(async (tx) => {
      await this.lockMaterial(tx, pointer.materialId);
      const res = await this.lockReservation(tx, reservationId);
      if (!res || res.studentId !== user.id) return { error: 'notFound' as const };
      // Terminal states and stale expiry both commit reconciliation inside the
      // transaction; the conflict is thrown after it returns.
      if (res.status !== 'ACTIVE' || (await this.isPastExpiry(tx, res.expiresAt))) {
        if (res.status === 'ACTIVE') await this.expireReservation(tx, res.id, res.materialId);
        return { error: 'conflict' as const };
      }
      const cancelled = await tx.reservation.update({
        where: { id: res.id },
        data: { status: 'CANCELED' },
        include: RESERVATION_INCLUDE,
      });
      await tx.material.update({
        where: { id: res.materialId },
        data: { status: 'AVAILABLE' },
      });
      await tx.auditEvent.create({
        data: {
          actorId: user.id,
          institutionId: cancelled.material.institutionId,
          materialId: res.materialId,
          reservationId: res.id,
          action: 'reservation.cancel',
        },
      });
      return { reservation: cancelled };
    });
    if ('error' in outcome) {
      if (outcome.error === 'notFound') throw new NotFoundException(NOT_FOUND);
      throw new ConflictException(TRANSITION_CONFLICT);
    }
    return toReservationDto(outcome.reservation, this.codes);
  }

  /**
   * Staff pickup confirmation: scoped membership + rate-limited, one-time
   * code before expiry → COMPLETED + material DELIVERED atomically. Every
   * failure mode (unknown, wrong institution, expired, already used) returns
   * the same generic 404 — no ownership or validity oracle.
   */
  async confirmPickup(
    staff: AuthenticatedUser,
    institutionId: string,
    rawCode: string,
    clientIp: string,
  ): Promise<PickupResultDto> {
    this.rateLimit.assertAllowed(
      `pickup:id:${staff.id}:${institutionId}`,
      PICKUP_PER_STAFF.limit,
      PICKUP_PER_STAFF.windowMs,
    );
    this.rateLimit.assertAllowed(`pickup:ip:${clientIp}`, PICKUP_PER_IP.limit, PICKUP_PER_IP.windowMs);

    const digest = this.codes.digestForSubmission(rawCode);
    if (!digest) throw new BadRequestException('Malformed pickup code');

    const pointer = await this.prisma.reservation.findUnique({
      where: { codeDigest: digest },
      include: { material: { select: { institutionId: true } } },
    });
    if (!pointer || pointer.material.institutionId !== institutionId) {
      throw new NotFoundException(INVALID_CODE);
    }

    const outcome = await this.prisma.$transaction(async (tx) => {
      await this.lockMaterial(tx, pointer.materialId);
      const res = await this.lockReservation(tx, pointer.id);
      if (!res || res.status !== 'ACTIVE') return { error: true as const };
      // Expired code → reconcile inside the same transaction, generic 404 after.
      if (await this.isPastExpiry(tx, res.expiresAt)) {
        await this.expireReservation(tx, res.id, res.materialId);
        return { error: true as const };
      }
      const completedAt = new Date();
      await tx.reservation.update({
        where: { id: res.id },
        data: { status: 'COMPLETED', completedAt, completedBy: staff.id },
      });
      await tx.material.update({
        where: { id: res.materialId },
        data: { status: 'DELIVERED' },
      });
      await tx.auditEvent.create({
        data: {
          actorId: staff.id,
          institutionId,
          materialId: res.materialId,
          reservationId: res.id,
          action: 'reservation.pickup',
        },
      });
      return {
        result: {
          reservationId: res.id,
          materialId: res.materialId,
          status: 'COMPLETED' as const,
          completedAt: completedAt.toISOString(),
        },
      };
    });
    if ('error' in outcome) throw new NotFoundException(INVALID_CODE);
    return outcome.result;
  }

  /** Staff dashboard — membership-scoped counts after expiry reconciliation. */
  async dashboard(institutionId: string): Promise<DashboardDto> {
    await this.expiry.reconcileExpired({ institutionId });
    const groups = await this.prisma.material.groupBy({
      by: ['status'],
      where: { institutionId },
      _count: { _all: true },
    });
    const count = (s: MaterialStatus) => groups.find((g) => g.status === s)?._count._all ?? 0;
    return {
      pendingReceipt: count('PENDING_RECEIPT'),
      available: count('AVAILABLE'),
      reserved: count('RESERVED'),
      delivered: count('DELIVERED'),
    };
  }

  // --- internals -----------------------------------------------------------

  /** Locks one material row FOR UPDATE inside the caller's transaction. */
  private async lockMaterial(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<LockedMaterialRow | undefined> {
    if (!UUID_PATTERN.test(id)) return undefined;
    const rows = await tx.$queryRaw<LockedMaterialRow[]>`
      SELECT m.id,
             m.donor_id AS "donorId",
             m.institution_id AS "institutionId",
             i.is_active AS "institutionIsActive",
             m.status
        FROM materials m
        JOIN institutions i ON i.id = m.institution_id
       WHERE m.id = ${id}::uuid
       FOR UPDATE OF m`;
    return rows[0];
  }

  /** Locks one reservation row FOR UPDATE — always after the material lock. */
  private async lockReservation(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<LockedReservationRow | undefined> {
    const rows = await tx.$queryRaw<LockedReservationRow[]>`
      SELECT id,
             material_id AS "materialId",
             student_id AS "studentId",
             status,
             expires_at AS "expiresAt"
        FROM reservations
        WHERE id = ${id}::uuid
        FOR UPDATE`;
    return rows[0];
  }

  /** Expires the material's stale ACTIVE reservation, if any (lock held). */
  private async expireStaleForMaterial(tx: Prisma.TransactionClient, materialId: string) {
    const stale = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM reservations
       WHERE material_id = ${materialId}::uuid
         AND status = 'ACTIVE'
         AND expires_at <= now()
       FOR UPDATE`;
    for (const row of stale) {
      await this.expireReservation(tx, row.id, materialId);
    }
  }

  /** True when the reservation's expiry is already past per the DB clock. */
  private async isPastExpiry(tx: Prisma.TransactionClient, expiresAt: Date): Promise<boolean> {
    const rows = await tx.$queryRaw<{ expired: boolean }[]>`
      SELECT (${expiresAt}::timestamptz <= now()) AS expired`;
    return rows[0]?.expired ?? false;
  }

  /** Terminates one reservation EXPIRED and frees its RESERVED material. */
  private async expireReservation(
    tx: Prisma.TransactionClient,
    reservationId: string,
    materialId: string,
  ) {
    const institutionId = (
      await tx.$queryRaw<{ institutionId: string }[]>`
        SELECT institution_id AS "institutionId" FROM materials WHERE id = ${materialId}::uuid`
    )[0]?.institutionId;
    await tx.reservation.update({ where: { id: reservationId }, data: { status: 'EXPIRED' } });
    await tx.material.updateMany({
      where: { id: materialId, status: 'RESERVED' },
      data: { status: 'AVAILABLE' },
    });
    await tx.auditEvent.create({
      data: {
        action: 'reservation.expire',
        institutionId,
        materialId,
        reservationId,
      },
    });
  }

  /**
   * Creates the ACTIVE reservation. The pickup code is derived from the
   * reservation id; an improbable digest collision retries with a fresh id
   * (BUSINESS_RULES). The partial unique index backstops one live reservation.
   */
  private async createReservationWithRetry(
    tx: Prisma.TransactionClient,
    materialId: string,
    studentId: string,
  ) {
    const expiresAt = new Date(Date.now() + RESERVATION_TTL_MS);
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      const id = randomUUID();
      const normalized = this.codes.normalizeCode(this.codes.codeForReservation(id));
      const codeDigest = this.codes.digestFor(normalized as string);
      try {
        return await tx.reservation.create({
          data: { id, materialId, studentId, status: 'ACTIVE', codeDigest, expiresAt },
          include: RESERVATION_INCLUDE,
        });
      } catch (error) {
        lastError = error;
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const target = `${JSON.stringify(error.meta ?? {})} ${error.message}`;
          if (target.includes('code_digest')) continue; // collision — regenerate id
          if (target.includes('reservation_one_active_per_material') || target.includes('material_id')) {
            throw new ConflictException(TRANSITION_CONFLICT);
          }
        }
        throw error;
      }
    }
    throw lastError ?? new ConflictException(TRANSITION_CONFLICT);
  }
}
