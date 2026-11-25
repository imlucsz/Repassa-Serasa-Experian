import { parseMaterialFields, parseUuid, type Material } from './contract.ts';
import {
  pickupCodeFormat,
  statusLabels,
  type MaterialStatus,
} from './operations.ts';

export type ReservationStatus = 'ACTIVE' | 'CANCELED' | 'EXPIRED' | 'COMPLETED';
export type OwnReservation = {
  id: string;
  status: ReservationStatus;
  material: Omit<Material, 'status'> & { status: MaterialStatus };
  materialId: string;
  expiresAt: string;
  createdAt: string;
  completedAt: string | null;
  pickupCode: string | null;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isStatus(value: unknown): value is ReservationStatus {
  return (
    value === 'ACTIVE' ||
    value === 'CANCELED' ||
    value === 'EXPIRED' ||
    value === 'COMPLETED'
  );
}

export function parseOwnReservation(
  value: unknown,
  now = Date.now(),
): OwnReservation | null {
  if (!record(value) || !record(value.material)) return null;
  const { material, status, pickupCode, expiresAt, createdAt, completedAt } =
    value;
  if (
    !isStatus(status) ||
    typeof material.status !== 'string' ||
    !Object.hasOwn(statusLabels, material.status) ||
    !isDate(expiresAt) ||
    !isDate(createdAt) ||
    !(completedAt === null || isDate(completedAt)) ||
    !(
      pickupCode === null ||
      (typeof pickupCode === 'string' && pickupCodeFormat.test(pickupCode))
    )
  )
    return null;
  try {
    const fields = parseMaterialFields(material);
    return {
      id: parseUuid(value.id),
      status,
      materialId: fields.id,
      material: { ...fields, status: material.status as MaterialStatus },
      createdAt,
      expiresAt,
      completedAt,
      pickupCode:
        status === 'ACTIVE' && Date.parse(expiresAt) > now ? pickupCode : null,
    };
  } catch {
    return null;
  }
}
