import { parsePage, parseUuid } from './contract.ts';
import { requestOperation } from './operations.ts';
import {
  parseOwnReservation,
  type OwnReservation,
} from './reservationModel.ts';

export type HistoryReservation = OwnReservation;

function parseHistoryReservation(value: unknown): HistoryReservation {
  const result = parseOwnReservation(value);
  if (!result) throw new Error('Reserva inválida.');
  return result;
}

export function listMyReservations(
  page = 1,
  pageSize = 10,
  signal?: AbortSignal,
  status?: OwnReservation['status'],
) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (status) params.set('status', status);
  return requestOperation(
    'me/reservations?' + params,
    { signal },
    (value) => {
      const result = parsePage(value, parseHistoryReservation);
      if (
        result.page !== page ||
        result.pageSize !== pageSize ||
        (status && result.items.some((item) => item.status !== status))
      )
        throw new Error('Página de reservas inválida.');
      return result;
    },
    200,
  );
}

export function cancelReservation(id: string, signal?: AbortSignal) {
  return requestOperation(
    'reservations/' + parseUuid(id) + '/cancel',
    { method: 'POST', signal },
    (value) => {
      const result = parseHistoryReservation(value);
      if (result.id !== id || result.status !== 'CANCELED')
        throw new Error('Cancelamento sem confirmação.');
      return result;
    },
    200,
  );
}
