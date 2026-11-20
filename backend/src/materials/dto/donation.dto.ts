import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { Category, Condition } from '@prisma/client';

/** POST /donations — DonationInput. No donor/status fields: server-owned. */
export class DonationDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(3, 120)
  title!: string;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(10, 1000)
  description!: string;

  @IsEnum(Category)
  category!: Category;

  @IsEnum(Condition)
  condition!: Condition;

  @IsUUID()
  institutionId!: string;

  @IsOptional()
  @IsUUID()
  uploadId?: string;
}

/** POST /institutions/{institutionId}/materials/{id}/reject — RejectInput. */
export class RejectDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(3, 240)
  reason!: string;
}
