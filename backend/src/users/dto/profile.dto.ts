import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

/** PATCH /me — ProfileInput. displayName is the only editable field. */
export class ProfileDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 80)
  displayName!: string;
}
