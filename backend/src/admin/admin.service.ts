import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Institution } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  toAdminAuditEventDto,
  toAdminInstitutionDto,
  toAdminMemberDto,
  toAdminReservationDto,
  toAdminUserDto,
  type AdminAuditEventDto,
  type AdminInstitutionDto,
  type AdminMemberDto,
  type AdminReservationDto,
  type AdminUserDto,
} from './admin.mapper';
import { toMaterialDto, type MaterialDto } from '../materials/material.mapper';
import type {
  AdminAuditQueryDto,
  AdminInstitutionQueryDto,
  AdminMaterialQueryDto,
  AdminReservationQueryDto,
  AdminUserQueryDto,
} from './dto/admin-queries.dto';

const NOT_FOUND = 'Not found';
const USER_SELECT = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { memberships: true } },
} satisfies Prisma.UserSelect;

interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

/**
 * Platform administration — every mutation writes an `admin.*` audit event in
 * the same transaction. All routes require Role.ADMIN (RolesGuard reads the
 * DB-fresh role; JWT claims are never trusted).
 */
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ── institutions ──────────────────────────────────────────────────────────

  async listInstitutions(query: AdminInstitutionQueryDto): Promise<Page<AdminInstitutionDto>> {
    const where: Prisma.InstitutionWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { publicAddress: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.institution.findMany({
        where,
        include: { _count: { select: { memberships: true, materials: true } } },
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.institution.count({ where }),
    ]);
    return { items: items.map(toAdminInstitutionDto), page: query.page, pageSize: query.pageSize, total };
  }

  /** PENDING → APPROVED (+isActive). Any other state is a 409. */
  async approveInstitution(admin: AuthenticatedUser, id: string): Promise<AdminInstitutionDto> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const inst = await this.findInstitution(tx, id);
      if (inst.status !== 'PENDING') {
        throw new ConflictException(`Institution is ${inst.status.toLowerCase()}; only pending institutions can be approved`);
      }
      const next = await tx.institution.update({
        where: { id },
        data: { status: 'APPROVED', isActive: true },
        include: { _count: { select: { memberships: true, materials: true } } },
      });
      await this.audit(tx, admin, 'admin.institution_approve', { institutionId: id });
      return next;
    });
    return toAdminInstitutionDto(updated);
  }

  /** PENDING → REJECTED (terminal). Reason is required for accountability. */
  async rejectInstitution(admin: AuthenticatedUser, id: string, reason: string): Promise<AdminInstitutionDto> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const inst = await this.findInstitution(tx, id);
      if (inst.status !== 'PENDING') {
        throw new ConflictException(`Institution is ${inst.status.toLowerCase()}; only pending institutions can be rejected`);
      }
      const next = await tx.institution.update({
        where: { id },
        data: { status: 'REJECTED', isActive: false },
        include: { _count: { select: { memberships: true, materials: true } } },
      });
      await this.audit(tx, admin, 'admin.institution_reject', {
        institutionId: id,
        metadata: { reason: reason.trim() },
      });
      return next;
    });
    return toAdminInstitutionDto(updated);
  }

  /** Reactivate an APPROVED institution. PENDING/REJECTED cannot be activated. */
  async activateInstitution(admin: AuthenticatedUser, id: string): Promise<AdminInstitutionDto> {
    return this.setInstitutionActive(admin, id, true);
  }

  /** Suspend an APPROVED institution — hides from catalog, blocks new donations
   *  and reservations; in-flight reservations can still be fulfilled/cancelled. */
  async deactivateInstitution(admin: AuthenticatedUser, id: string): Promise<AdminInstitutionDto> {
    return this.setInstitutionActive(admin, id, false);
  }

  private async setInstitutionActive(
    admin: AuthenticatedUser,
    id: string,
    isActive: boolean,
  ): Promise<AdminInstitutionDto> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const inst = await this.findInstitution(tx, id);
      if (inst.status !== 'APPROVED') {
        throw new ConflictException(`Institution is ${inst.status.toLowerCase()}; only approved institutions can be activated or deactivated`);
      }
      if (inst.isActive === isActive) {
        throw new ConflictException(`Institution is already ${isActive ? 'active' : 'inactive'}`);
      }
      const next = await tx.institution.update({
        where: { id },
        data: { isActive },
        include: { _count: { select: { memberships: true, materials: true } } },
      });
      await this.audit(tx, admin, isActive ? 'admin.institution_activate' : 'admin.institution_deactivate', {
        institutionId: id,
      });
      return next;
    });
    return toAdminInstitutionDto(updated);
  }

  // ── memberships ───────────────────────────────────────────────────────────

  async listMembers(institutionId: string): Promise<AdminMemberDto[]> {
    await this.findInstitution(this.prisma, institutionId);
    const members = await this.prisma.membership.findMany({
      where: { institutionId },
      include: { user: { select: { email: true, displayName: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return members.map(toAdminMemberDto);
  }

  /**
   * Assign a staff membership: user must exist, be active and not ADMIN.
   * Promotes STUDENT → STAFF in the same transaction (a membership without the
   * role is unusable). Re-adding an existing member is a 409.
   */
  async assignMember(admin: AuthenticatedUser, institutionId: string, userId: string): Promise<AdminMemberDto> {
    const created = await this.prisma.$transaction(async (tx) => {
      const inst = await this.findInstitution(tx, institutionId);
      if (inst.status !== 'APPROVED') {
        throw new ConflictException('Staff can only be assigned to approved institutions');
      }
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException(NOT_FOUND);
      if (!user.isActive) throw new ConflictException('Cannot assign membership to a deactivated user');
      if (user.role === 'ADMIN') throw new ConflictException('Administrator accounts cannot hold staff memberships');

      const membership = await tx.membership
        .create({ data: { userId, institutionId } })
        .catch((e: unknown) => {
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
            throw new ConflictException('User is already a member of this institution');
          }
          throw e;
        });
      if (user.role === 'STUDENT') {
        await tx.user.update({ where: { id: userId }, data: { role: 'STAFF' } });
      }
      await this.audit(tx, admin, 'admin.membership_assign', { institutionId, metadata: { targetUserId: userId } });
      return tx.membership.findUniqueOrThrow({
        where: { id: membership.id },
        include: { user: { select: { email: true, displayName: true } } },
      });
    });
    return toAdminMemberDto(created);
  }

  /**
   * Revoke a staff membership. When the user loses their last membership they
   * are demoted STAFF → STUDENT in the same transaction (documented decision).
   */
  async revokeMember(admin: AuthenticatedUser, institutionId: string, userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const membership = await tx.membership.findUnique({
        where: { userId_institutionId: { userId, institutionId } },
      });
      if (!membership) throw new NotFoundException(NOT_FOUND);
      await tx.membership.delete({ where: { id: membership.id } });
      const remaining = await tx.membership.count({ where: { userId } });
      if (remaining === 0) {
        await tx.user.updateMany({
          where: { id: userId, role: 'STAFF' },
          data: { role: 'STUDENT' },
        });
      }
      await this.audit(tx, admin, 'admin.membership_revoke', { institutionId, metadata: { targetUserId: userId } });
    });
  }

  // ── users ─────────────────────────────────────────────────────────────────

  async listUsers(query: AdminUserQueryDto): Promise<Page<AdminUserDto>> {
    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.q
        ? {
            OR: [
              { email: { contains: query.q, mode: 'insensitive' } },
              { displayName: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: { createdAt: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items: items.map(toAdminUserDto), page: query.page, pageSize: query.pageSize, total };
  }

  /** STUDENT ↔ STAFF only; ADMIN rows are immutable via the API (out-of-band
   *  provisioning). STAFF → STUDENT drops all memberships in the same tx. */
  async setUserRole(admin: AuthenticatedUser, userId: string, role: 'STUDENT' | 'STAFF'): Promise<AdminUserDto> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException(NOT_FOUND);
      if (user.role === 'ADMIN') throw new ConflictException('Administrator roles are managed out of band');
      if (userId === admin.id) throw new ConflictException('Administrators cannot change their own role');
      if (user.role === role) throw new ConflictException(`User already has role ${role}`);
      if (role === 'STUDENT') {
        await tx.membership.deleteMany({ where: { userId } });
      }
      const next = await tx.user.update({ where: { id: userId }, data: { role }, select: USER_SELECT });
      await this.audit(tx, admin, 'admin.user_role', { metadata: { targetUserId: userId, role } });
      return next;
    });
    return toAdminUserDto(updated);
  }

  async activateUser(admin: AuthenticatedUser, userId: string): Promise<AdminUserDto> {
    return this.setUserActive(admin, userId, true);
  }

  /** Deactivate: blocks the account immediately (AccessTokenGuard reloads the
   *  user on every request) and revokes every live refresh session. An admin
   *  cannot deactivate themselves (self-lockout guard). */
  async deactivateUser(admin: AuthenticatedUser, userId: string): Promise<AdminUserDto> {
    return this.setUserActive(admin, userId, false);
  }

  private async setUserActive(
    admin: AuthenticatedUser,
    userId: string,
    isActive: boolean,
  ): Promise<AdminUserDto> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException(NOT_FOUND);
      if (!isActive && userId === admin.id) {
        throw new ConflictException('Administrators cannot deactivate their own account');
      }
      if (user.isActive === isActive) {
        throw new ConflictException(`User is already ${isActive ? 'active' : 'inactive'}`);
      }
      const next = await tx.user.update({ where: { id: userId }, data: { isActive }, select: USER_SELECT });
      if (!isActive) {
        await tx.refreshSession.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await this.audit(tx, admin, isActive ? 'admin.user_activate' : 'admin.user_deactivate', {
        metadata: { targetUserId: userId },
      });
      return next;
    });
    return toAdminUserDto(updated);
  }

  // ── read-only admin views ──────────────────────────────────────────────────

  async listMaterials(query: AdminMaterialQueryDto): Promise<Page<MaterialDto>> {
    const where: Prisma.MaterialWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.institutionId ? { institutionId: query.institutionId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.material.findMany({
        where,
        include: { institution: true },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.material.count({ where }),
    ]);
    return { items: items.map(toMaterialDto), page: query.page, pageSize: query.pageSize, total };
  }

  async listReservations(query: AdminReservationQueryDto): Promise<Page<AdminReservationDto>> {
    const where: Prisma.ReservationWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.institutionId ? { material: { institutionId: query.institutionId } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.reservation.findMany({
        where,
        include: { material: { include: { institution: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.reservation.count({ where }),
    ]);
    return { items: items.map(toAdminReservationDto), page: query.page, pageSize: query.pageSize, total };
  }

  async listAuditEvents(query: AdminAuditQueryDto): Promise<Page<AdminAuditEventDto>> {
    const action = query.action?.endsWith('.')
      ? { startsWith: query.action }
      : query.action
        ? { equals: query.action }
        : undefined;
    const where: Prisma.AuditEventWhereInput = {
      ...(action ? { action } : {}),
      ...(query.institutionId ? { institutionId: query.institutionId } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.auditEvent.count({ where }),
    ]);
    return { items: items.map(toAdminAuditEventDto), page: query.page, pageSize: query.pageSize, total };
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private async findInstitution(
    db: Prisma.TransactionClient | PrismaService,
    id: string,
  ): Promise<Institution> {
    const inst = await db.institution.findUnique({ where: { id } });
    if (!inst) throw new NotFoundException(NOT_FOUND);
    return inst;
  }

  private async audit(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedUser,
    action: string,
    refs: { institutionId?: string; materialId?: string; reservationId?: string; metadata?: Prisma.InputJsonValue },
  ): Promise<void> {
    await tx.auditEvent.create({
      data: {
        actorId: actor.id,
        action,
        institutionId: refs.institutionId,
        materialId: refs.materialId,
        reservationId: refs.reservationId,
        metadata: refs.metadata,
      },
    });
  }
}
