import { AuthError, authenticatedFetch } from './auth.ts';
import {
  parseInstitution,
  parseMaterialFields,
  parsePage,
  parseUuid,
  type Category,
  type Condition,
  type Institution,
  type Material,
  type Page,
} from './contract.ts';

export const statusLabels = {
  PENDING_RECEIPT: 'Aguardando entrega',
  AVAILABLE: 'Disponível',
  RESERVED: 'Reservado',
  DELIVERED: 'Retirado',
  CANCELED: 'Cancelado',
  REJECTED: 'Recusado',
} as const;
export type MaterialStatus = keyof typeof statusLabels;
export type ManagedMaterial = Omit<Material, 'status'> & {
  status: MaterialStatus;
  updatedAt: string;
  receivedAt: string | null;
  rejectReason: string | null;
};
export type DonationInput = {
  title: string;
  description: string;
  category: Category;
  condition: Condition;
  institutionId: string;
  uploadId?: string | null;
};
export type Dashboard = {
  pendingReceipt: number;
  available: number;
  reserved: number;
  delivered: number;
};
export type PickupResult = {
  reservationId: string;
  materialId: string;
  status: 'COMPLETED';
  completedAt: string;
};
export type ManagedQuery = {
  status?: MaterialStatus;
  q?: string;
  page?: number;
  pageSize?: number;
};

export class OperationError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'OperationError';
  }
}

const errors: Record<number, string> = {
  400: 'Confira os dados informados.',
  401: 'A sessão expirou. Entre novamente para continuar.',
  403: 'Sua conta não tem acesso a esta operação.',
  404: 'Este registro está indisponível.',
  409: 'A situação deste material mudou. Atualize a lista para conferir.',
  413: 'A foto deve ter até 5 MiB.',
  415: 'Escolha uma imagem JPEG, PNG ou WebP.',
  429: 'Muitas solicitações. Aguarde um momento antes de tentar novamente.',
};
const fieldMessages = {
  title: 'Informe um título de 3 a 120 caracteres.',
  description: 'Escreva uma descrição de 10 a 1.000 caracteres.',
  category: 'Selecione uma categoria.',
  condition: 'Selecione a condição do material.',
  institutionId: 'Selecione uma instituição ativa.',
  uploadId: 'Envie a foto novamente.',
  reason: 'Descreva o motivo em 3 a 240 caracteres.',
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(): never {
  throw new OperationError(
    502,
    'O serviço retornou dados inválidos. Atualize para consultar a situação.',
  );
}

function isDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function parseManaged(value: unknown): ManagedMaterial {
  if (
    !record(value) ||
    typeof value.status !== 'string' ||
    !Object.hasOwn(statusLabels, value.status) ||
    !isDate(value.updatedAt) ||
    !(value.receivedAt === null || isDate(value.receivedAt)) ||
    !(value.rejectReason === null || typeof value.rejectReason === 'string')
  )
    invalid();
  return {
    ...parseMaterialFields(value),
    status: value.status as MaterialStatus,
    updatedAt: value.updatedAt,
    receivedAt: value.receivedAt,
    rejectReason: value.rejectReason,
  };
}

async function request<T>(
  path: string,
  init: RequestInit,
  parse: (value: unknown) => T,
  expectedStatus?: number,
): Promise<T> {
  let response: Response;
  try {
    response = await authenticatedFetch('/api/v1/' + path, init);
  } catch (error) {
    init.signal?.throwIfAborted();
    if (error instanceof AuthError)
      throw new OperationError(error.status, error.message);
    throw new OperationError(
      0,
      'Não foi possível conectar ao serviço. Confira sua conexão.',
    );
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    init.signal?.throwIfAborted();
  }
  if (!response.ok) {
    const fields =
      record(body) && record(body.fieldErrors) ? body.fieldErrors : {};
    const fieldErrors = Object.fromEntries(
      Object.entries(fieldMessages)
        .filter(([key]) => Array.isArray(fields[key]))
        .map(([key, message]) => [key, [message]]),
    );
    throw new OperationError(
      response.status,
      errors[response.status] ??
        'O serviço está indisponível. Tente novamente mais tarde.',
      fieldErrors,
    );
  }
  if (expectedStatus !== undefined && response.status !== expectedStatus)
    invalid();
  try {
    return parse(body);
  } catch {
    return invalid();
  }
}

function post(signal?: AbortSignal, json?: object): RequestInit {
  return json === undefined
    ? { method: 'POST', signal }
    : {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      };
}

export { request as requestOperation };

function expectChange(
  status: MaterialStatus,
  institutionId?: string,
  materialId?: string,
) {
  return (value: unknown) => {
    const material = parseManaged(value);
    if (
      material.status !== status ||
      (institutionId && material.institution.id !== institutionId) ||
      (materialId && material.id !== materialId)
    )
      invalid();
    return material;
  };
}

export function upload(file: File, signal?: AbortSignal): Promise<string> {
  const form = new FormData();
  form.set('file', file);
  return request('uploads', { method: 'POST', signal, body: form }, (value) =>
    parseUuid(record(value) && value.uploadId),
  );
}

export function createDonation(
  input: DonationInput,
  signal?: AbortSignal,
): Promise<ManagedMaterial> {
  const { title, description, category, condition, institutionId, uploadId } =
    input;
  return request(
    'donations',
    post(signal, {
      title,
      description,
      category,
      condition,
      institutionId,
      uploadId,
    }),
    expectChange('PENDING_RECEIPT', institutionId),
  );
}

export function cancelDonation(
  id: string,
  signal?: AbortSignal,
): Promise<ManagedMaterial> {
  return request(
    'donations/' + parseUuid(id) + '/cancel',
    post(signal),
    expectChange('CANCELED', undefined, id),
  );
}

function collectionPath(
  path: string,
  { page = 1, pageSize = 20, status, q }: ManagedQuery,
) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (status) params.set('status', status);
  if (q) params.set('q', q);
  return path + '?' + params;
}

function materialPage(
  path: string,
  query: ManagedQuery,
  signal?: AbortSignal,
  institutionId?: string,
): Promise<Page<ManagedMaterial>> {
  return request(collectionPath(path, query), { signal }, (value) => {
    const result = parsePage(value, parseManaged);
    if (
      result.page !== (query.page ?? 1) ||
      result.items.some(
        (item) =>
          (institutionId && item.institution.id !== institutionId) ||
          (query.status && item.status !== query.status),
      )
    )
      invalid();
    return result;
  });
}

export function listDonations(
  page = 1,
  pageSize = 20,
  signal?: AbortSignal,
  status?: MaterialStatus,
) {
  return materialPage('me/donations', { page, pageSize, status }, signal);
}

export async function listMemberships(
  signal?: AbortSignal,
): Promise<Institution[]> {
  const items: Institution[] = [];
  for (let page = 1; ; page++) {
    const result = await request(
      collectionPath('me/institutions', { page, pageSize: 50 }),
      { signal },
      (value) => parsePage(value, parseInstitution),
    );
    if (result.page !== page) invalid();
    items.push(...result.items);
    if (page * result.pageSize >= result.total) return items;
    if (!result.items.length) invalid();
  }
}

function institutionMaterials(id: string) {
  return 'institutions/' + parseUuid(id) + '/materials';
}

export function listManagedMaterials(
  institutionId: string,
  query: ManagedQuery = {},
  signal?: AbortSignal,
) {
  return materialPage(
    institutionMaterials(institutionId),
    query,
    signal,
    institutionId,
  );
}

export function receiveMaterial(
  institutionId: string,
  id: string,
  signal?: AbortSignal,
) {
  return request(
    institutionMaterials(institutionId) + '/' + parseUuid(id) + '/receive',
    post(signal),
    expectChange('AVAILABLE', institutionId, id),
  );
}

export function rejectMaterial(
  institutionId: string,
  id: string,
  reason: string,
  signal?: AbortSignal,
) {
  return request(
    institutionMaterials(institutionId) + '/' + parseUuid(id) + '/reject',
    post(signal, { reason }),
    expectChange('REJECTED', institutionId, id),
  );
}

function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    invalid();
  return value;
}

export function getDashboard(
  institutionId: string,
  signal?: AbortSignal,
): Promise<Dashboard> {
  return request(
    'institutions/' + parseUuid(institutionId) + '/dashboard',
    { signal },
    (value) => {
      if (!record(value)) invalid();
      return {
        pendingReceipt: count(value.pendingReceipt),
        available: count(value.available),
        reserved: count(value.reserved),
        delivered: count(value.delivered),
      };
    },
    200,
  );
}

export const pickupCodeFormat =
  /^[0-9A-HJKMNP-TV-Z]{4}-?[0-9A-HJKMNP-TV-Z]{4}-?[0-9A-HJKMNP-TV-Z]{4}$/i;

export function confirmPickup(
  institutionId: string,
  code: string,
  signal?: AbortSignal,
): Promise<PickupResult> {
  return request(
    'institutions/' + parseUuid(institutionId) + '/pickups/confirm',
    post(signal, { code }),
    (value) => {
      if (
        !record(value) ||
        value.status !== 'COMPLETED' ||
        !isDate(value.completedAt)
      )
        invalid();
      return {
        reservationId: parseUuid(value.reservationId),
        materialId: parseUuid(value.materialId),
        status: value.status,
        completedAt: value.completedAt,
      };
    },
    200,
  );
}
