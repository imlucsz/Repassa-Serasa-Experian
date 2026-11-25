import { authenticatedFetch } from './auth.ts';
import { listMyReservations } from './myReservations.ts';
import { OperationError } from './operations.ts';
import {
  parseOwnReservation,
  type OwnReservation,
} from './reservationModel.ts';

export type ReservationResult =
  | { kind: 'confirmed'; expiresAt: string }
  | { kind: 'login' | 'unavailable' | 'uncertain' | 'retry'; message: string };

function confirmed(reservation: OwnReservation | null, materialId: string) {
  if (
    reservation?.materialId === materialId &&
    reservation.status === 'ACTIVE' &&
    Date.parse(reservation.expiresAt) > Date.now()
  ) {
    // The shareable material route needs the deadline only.
    return { kind: 'confirmed', expiresAt: reservation.expiresAt } as const;
  }
}

const loginRequired = {
  kind: 'login',
  message: 'Entre para continuar.',
} as const;

/** A lost POST response may already represent a committed reservation. Only read on recovery. */
export async function checkReservation(
  materialId: string,
  signal: AbortSignal,
): Promise<ReservationResult> {
  try {
    for (let page = 1; ; page++) {
      const history = await listMyReservations(page, 50, signal, 'ACTIVE');
      const match = history.items.find(
        (item) => item.materialId === materialId,
      );
      const result = confirmed(match ?? null, materialId);
      if (result) return result;
      if (!history.items.length || page * history.pageSize >= history.total)
        break;
    }
  } catch (error) {
    signal.throwIfAborted();
    if (error instanceof OperationError && error.status === 401)
      return loginRequired;
  }
  return {
    kind: 'uncertain',
    message:
      'Ainda não foi possível confirmar a reserva. Consulte suas reservas antes de fazer outro pedido.',
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
        const result = confirmed(
          parseOwnReservation(await response.json()),
          materialId,
        );
        if (result) return result;
        break;
      }
      case 401:
        return loginRequired;
      case 403:
        return {
          kind: 'unavailable',
          message:
            'Sua conta não pode reservar este material. A reserva deve ser feita por outro estudante que não seja o doador.',
        };
      case 404:
        return {
          kind: 'unavailable',
          message: 'Este material já não está disponível no acervo.',
        };
      case 409:
        return {
          kind: 'unavailable',
          message:
            'Este material já foi reservado. Consulte suas reservas ou escolha outro material no acervo.',
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
