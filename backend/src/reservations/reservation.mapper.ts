import type { Institution, Material, Reservation } from '@prisma/client';
import { toMaterialDto, type MaterialDto } from '../materials/material.mapper';
import type { PickupCodeService } from './pickup-code.service';

/** Contract `Reservation` — owner view; pickupCode only while ACTIVE/unexpired. */
export interface ReservationDto {
  id: string;
  material: MaterialDto;
  status: Reservation['status'];
  expiresAt: string;
  pickupCode: string | null;
  createdAt: string;
  completedAt: string | null;
}

type ReservationWithMaterial = Reservation & { material: Material & { institution: Institution } };

export function toReservationDto(
  reservation: ReservationWithMaterial,
  codes: PickupCodeService,
  now = new Date(),
): ReservationDto {
  const live = reservation.status === 'ACTIVE' && reservation.expiresAt > now;
  return {
    id: reservation.id,
    material: toMaterialDto(reservation.material),
    status: reservation.status,
    expiresAt: reservation.expiresAt.toISOString(),
    // Code is derived on demand — plaintext never persists (BUSINESS_RULES).
    pickupCode: live ? codes.codeForReservation(reservation.id) : null,
    createdAt: reservation.createdAt.toISOString(),
    completedAt: reservation.completedAt?.toISOString() ?? null,
  };
}
