import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Category, MaterialStatus } from '@prisma/client';

abstract class PageQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize: number = 20;
}

/** GET /materials — public catalog filters. */
export class CatalogQueryDto extends PageQuery {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsEnum(Category)
  category?: Category;

  @IsOptional()
  @IsUUID()
  institutionId?: string;
}

/** GET /me/donations — donor history filter (contract: status only). */
export class MyDonationsQueryDto extends PageQuery {
  @IsOptional()
  @IsEnum(MaterialStatus)
  status?: MaterialStatus;
}

/** GET /institutions/{id}/materials — staff stock filters. */
export class ManagedMaterialQueryDto extends PageQuery {
  @IsOptional()
  @IsEnum(MaterialStatus)
  status?: MaterialStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}
