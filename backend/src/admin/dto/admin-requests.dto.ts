import { IsEnum, IsNotIn, IsString, IsUUID, Length } from 'class-validator';
import { Role } from '@prisma/client';

export class RejectInstitutionDto {
  /** Reason is required for accountability — mirrors staff material rejection. */
  @IsString()
  @Length(3, 240)
  reason!: string;
}

export class AssignMemberDto {
  @IsUUID()
  userId!: string;
}

export class SetUserRoleDto {
  /** ADMIN is never assignable through the API — out-of-band provisioning only. */
  @IsEnum(Role)
  @IsNotIn([Role.ADMIN])
  role!: 'STUDENT' | 'STAFF';
}
