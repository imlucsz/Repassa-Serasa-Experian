import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { ReservationStatus } from '@prisma/client';
import { PageQueryDto } from '../../institutions/dto/page-query.dto';

/** GET /me/reservations — contract filter: optional status. */
export class MyReservationsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;
}

/**
 * POST /institutions/{id}/pickups/confirm — contract PickupInput:
 * 12 Crockford-style chars grouped 4-4-4, optional single dashes between
 * groups (the pattern allows lowercase input; server normalizes).
 */
export class PickupConfirmDto {
  @IsString()
  @Matches(/^[0-9A-HJ-KM-NP-TV-Za-hj-km-np-tv-z]{4}-?[0-9A-HJ-KM-NP-TV-Za-hj-km-np-tv-z]{4}-?[0-9A-HJ-KM-NP-TV-Za-hj-km-np-tv-z]{4}$/, {
    message: 'code must be 12 pickup characters, optionally grouped with dashes',
  })
  code!: string;
}
