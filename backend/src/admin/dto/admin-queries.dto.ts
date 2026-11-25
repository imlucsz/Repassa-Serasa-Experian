import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import { InstitutionStatus, MaterialStatus, ReservationStatus, Role } from '@prisma/client';
import { PageQueryDto } from '../../institutions/dto/page-query.dto';

const toBool = () => Transform(({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value,
);

export class AdminInstitutionQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(InstitutionStatus)
  status?: InstitutionStatus;

  @IsOptional()
  @toBool()
  @IsBoolean()
  isActive?: boolean;

  /** Case-insensitive substring match on name/publicAddress. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}

export class AdminUserQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @toBool()
  @IsBoolean()
  isActive?: boolean;

  /** Case-insensitive substring match on email/displayName. */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  q?: string;
}

export class AdminMaterialQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(MaterialStatus)
  status?: MaterialStatus;

  @IsOptional()
  @IsUUID()
  institutionId?: string;
}

export class AdminReservationQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;

  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;
}

export class AdminAuditQueryDto extends PageQueryDto {
  /** Exact action name (e.g. admin.institution_approve) or prefix ending in '.'. */
  @IsOptional()
  @IsString()
  @Length(1, 120)
  action?: string;

  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @IsOptional()
  @IsUUID()
  actorId?: string;
}
