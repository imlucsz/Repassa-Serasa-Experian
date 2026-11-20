import { authenticatedFetch } from './auth.ts';

export type OwnReservation = {
  id: string;
  status: 'ACTIVE' | 'CANCELED' | 'EXPIRED' | 'COMPLETED';
  materialId: string;
  expiresAt: string;
  pickupCode: string | null;
};

const uuidPattern = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
const pickupCodePattern =
  /^[0-9A-HJKMNP-TV-Z]{4}(?:-?[0-9A-HJKMNP-TV-Z]{4}){2}$/i;

export function parseOwnReservation(value: unknown): OwnReservation | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result = value as Record<string, unknown>;
  const material = result.material;
  if (!material || typeof material !== 'object' || Array.isArray(material))
    return null;
  const materialId = (material as Record<string, unknown>).id;
  if (
    typeof result.id !== 'string' ||
    !uuidPattern.test(result.id) ||
    typeof materialId !== 'string' ||
    !uuidPattern.test(materialId) ||
    !['ACTIVE', 'CANCELED', 'EXPIRED', 'COMPLETED'].includes(
      String(result.status),
    ) ||
    typeof result.expiresAt !== 'string' ||
    !Number.isFinite(Date.parse(result.expiresAt)) ||
    typeof result.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(result.createdAt)) ||
    !(
      result.completedAt === null ||
      (typeof result.completedAt === 'string' &&
        Number.isFinite(Date.parse(result.completedAt)))
    ) ||
    !(
      result.pickupCode === null ||
      (typeof result.pickupCode === 'string' &&
        pickupCodePattern.test(result.pickupCode))
    )
  )
    return null;

  return {
    id: result.id,
    status: result.status as OwnReservation['status'],
    materialId,
    expiresAt: result.expiresAt,
    pickupCode: result.pickupCode,
  };
}

export function findOwnReservation(
  value: unknown,
  materialId: string,
): OwnReservation | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const items = (value as Record<string, unknown>).items;
  if (!Array.isArray(items)) return null;
  for (const item of items) {
    const reservation = parseOwnReservation(item);
    if (
      reservation?.materialId === materialId &&
      reservation.status === 'ACTIVE'
    )
      return reservation;
  }
  return null;
}

export type ReservationResult =
  | { kind: 'confirmed'; reservation: OwnReservation }
  | { kind: 'login' | 'unavailable' | 'uncertain' | 'retry'; message: string };

/** Read the student's own history when a POST may already have committed. */
export async function checkReservation(
  materialId: string,
  signal: AbortSignal,
): Promise<ReservationResult> {
  try {
    for (let page = 1; ; page++) {
      const response = await authenticatedFetch(
        '/api/v1/me/reservations?page=' + page + '&pageSize=50',
        { signal },
      );
      if (!response.ok) break;
      const data = await response.json();
      const found = findOwnReservation(data, materialId);
      if (found) return { kind: 'confirmed', reservation: found };
      if (
        data?.page !== page ||
        !Number.isSafeInteger(data.total) ||
        !Number.isSafeInteger(data.pageSize) ||
        data.pageSize < 1 ||
        !data.items?.length ||
        page * data.pageSize >= data.total
      )
        break;
    }
  } catch {
    signal.throwIfAborted();
  }
  return {
    kind: 'uncertain',
    message:
      'A solicitação foi enviada. Consulte a situação da reserva antes de fazer outro pedido.',
  };
}

export async function reserveMaterial(
  materialId: string,
  signal: AbortSignal,
): Promise<ReservationResult> {
  try {
    const response = await authenticatedFetch(
      '/api/v1/materials/' + encodeURIComponent(materialId) + '/reservations',
      { method: 'POST', signal },
    );
    switch (response.status) {
      case 201: {
        const reservation = parseOwnReservation(await response.json());
        if (
          reservation?.materialId === materialId &&
          reservation.status === 'ACTIVE'
        )
          return { kind: 'confirmed', reservation };
        break;
      }
      case 401:
        return { kind: 'login', message: 'Entre para continuar.' };
      case 403:
        return {
          kind: 'unavailable',
          message: 'Sua conta não pode reservar este material.',
        };
      case 404:
      case 409:
        return {
          kind: 'unavailable',
          message:
            'Este material está indisponível para esta reserva. Volte ao acervo para conferir as opções.',
        };
      case 429:
        return {
          kind: 'retry',
          message:
            'Muitas tentativas. Aguarde um momento antes de tentar novamente.',
        };
      case 400:
        return {
          kind: 'retry',
          message:
            'O servidor recusou a solicitação. Atualize a página para conferir este material.',
        };
    }
  } catch {
    signal.throwIfAborted();
  }
  return checkReservation(materialId, signal);
}
