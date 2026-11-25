import type { AuditEvent, Institution, Material, Membership, Reservation, User } from '@prisma/client';
import { toMaterialDto, type MaterialDto } from '../materials/material.mapper';

/** Admin institution view — includes lifecycle fields hidden from the public DTO. */
export interface AdminInstitutionDto {
  id: string;
  name: string;
  publicAddress: string;
  pickupInstructions: string;
  status: Institution['status'];
  isActive: boolean;
  memberCount: number;
  materialCount: number;
  createdAt: string;
  updatedAt: string;
}

type InstitutionWithCounts = Institution & {
  _count: { memberships: number; materials: number };
};

export function toAdminInstitutionDto(i: InstitutionWithCounts): AdminInstitutionDto {
  return {
    id: i.id,
    name: i.name,
    publicAddress: i.publicAddress,
    pickupInstructions: i.pickupInstructions,
    status: i.status,
    isActive: i.isActive,
    memberCount: i._count.memberships,
    materialCount: i._count.materials,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  };
}

/** Admin user view — passwordHash is never selected, never mapped. */
export interface AdminUserDto {
  id: string;
  email: string;
  displayName: string;
  role: User['role'];
  isActive: boolean;
  membershipCount: number;
  createdAt: string;
  updatedAt: string;
}

type UserWithCounts = Pick<
  User,
  'id' | 'email' | 'displayName' | 'role' | 'isActive' | 'createdAt' | 'updatedAt'
> & { _count: { memberships: number } };

export function toAdminUserDto(u: UserWithCounts): AdminUserDto {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
    isActive: u.isActive,
    membershipCount: u._count.memberships,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}

export interface AdminMemberDto {
  userId: string;
  institutionId: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export function toAdminMemberDto(m: Membership & { user: Pick<User, 'email' | 'displayName'> }): AdminMemberDto {
  return {
    userId: m.userId,
    institutionId: m.institutionId,
    email: m.user.email,
    displayName: m.user.displayName,
    createdAt: m.createdAt.toISOString(),
  };
}

/** Admin reservation view — pickup code is NEVER included (staff-scope data). */
export interface AdminReservationDto {
  id: string;
  status: Reservation['status'];
  materialId: string;
  material: MaterialDto;
  institutionId: string;
  studentId: string;
  expiresAt: string;
  completedAt: string | null;
  createdAt: string;
}

type ReservationWithRefs = Reservation & {
  material: Material & { institution: Institution };
};

export function toAdminReservationDto(r: ReservationWithRefs): AdminReservationDto {
  return {
    id: r.id,
    status: r.status,
    materialId: r.materialId,
    material: toMaterialDto(r.material),
    institutionId: r.material.institutionId,
    studentId: r.studentId,
    expiresAt: r.expiresAt.toISOString(),
    completedAt: r.completedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

export interface AdminAuditEventDto {
  id: string;
  action: string;
  actorId: string | null;
  institutionId: string | null;
  materialId: string | null;
  reservationId: string | null;
  metadata: unknown;
  createdAt: string;
}

export function toAdminAuditEventDto(e: AuditEvent): AdminAuditEventDto {
  return {
    id: e.id,
    action: e.action,
    actorId: e.actorId,
    institutionId: e.institutionId,
    materialId: e.materialId,
    reservationId: e.reservationId,
    metadata: e.metadata,
    createdAt: e.createdAt.toISOString(),
  };
}
