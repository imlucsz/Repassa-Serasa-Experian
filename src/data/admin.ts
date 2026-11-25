import {
  parseInstitution,
  parseMaterialFields,
  parsePage,
  parseUuid,
  type Institution,
  type Page,
} from './contract.ts';
import {
  OperationError,
  postOperation,
  requestOperation,
  statusLabels,
  type MaterialStatus,
} from './operations.ts';
import type { AuthUser } from './auth.ts';

export const institutionStatusLabels = {
  PENDING: 'Pendente',
  APPROVED: 'Aprovada',
  REJECTED: 'Recusada',
} as const;
export type InstitutionStatus = keyof typeof institutionStatusLabels;

export const roleLabels = {
  STUDENT: 'Estudante',
  STAFF: 'Equipe',
  ADMIN: 'Administração',
} as const;

export const reservationStatusLabels = {
  ACTIVE: 'Aguardando retirada',
  CANCELED: 'Cancelada',
  EXPIRED: 'Prazo encerrado',
  COMPLETED: 'Retirada concluída',
} as const;

export type AdminInstitution = Institution & {
  status: InstitutionStatus;
  isActive: boolean;
  memberCount: number;
  materialCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  role: AuthUser['role'];
  isActive: boolean;
  membershipCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminMember = {
  userId: string;
  institutionId: string;
  email: string;
  displayName: string;
  createdAt: string;
};

export type AdminMaterial = ReturnType<typeof parseMaterialFields> & {
  status: MaterialStatus;
};

export type AdminReservation = {
  id: string;
  status: keyof typeof reservationStatusLabels;
  materialId: string;
  material: AdminMaterial;
  institutionId: string;
  studentId: string;
  expiresAt: string;
  completedAt: string | null;
  createdAt: string;
};

export type AdminAuditEvent = {
  id: string;
  action: string;
  actorId: string | null;
  institutionId: string | null;
  materialId: string | null;
  reservationId: string | null;
  metadata: unknown;
  createdAt: string;
};

export type PageQuery = { page?: number; pageSize?: number };
export type AdminInstitutionQuery = PageQuery & {
  status?: InstitutionStatus;
  isActive?: boolean;
  q?: string;
};
export type AdminUserQuery = PageQuery & {
  role?: AuthUser['role'];
  isActive?: boolean;
  q?: string;
};
export type AdminMaterialQuery = PageQuery & {
  status?: MaterialStatus;
  institutionId?: string;
};
export type AdminReservationQuery = PageQuery & {
  status?: keyof typeof reservationStatusLabels;
  institutionId?: string;
  studentId?: string;
};
export type AdminAuditQuery = PageQuery & {
  action?: string;
  institutionId?: string;
  actorId?: string;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function optionalUuid(value: unknown): string | null {
  return value === null ? null : parseUuid(value);
}

function text(value: unknown): string {
  if (typeof value !== 'string') throw new Error('invalid');
  return value;
}

function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new Error('invalid');
  return value;
}

function parseAdminInstitution(value: unknown): AdminInstitution {
  if (!record(value)) throw new Error('invalid');
  if (
    typeof value.status !== 'string' ||
    !Object.hasOwn(institutionStatusLabels, value.status) ||
    typeof value.isActive !== 'boolean' ||
    !isDate(value.createdAt) ||
    !isDate(value.updatedAt)
  )
    throw new Error('invalid');
  return {
    ...parseInstitution(value),
    status: value.status as InstitutionStatus,
    isActive: value.isActive,
    memberCount: count(value.memberCount),
    materialCount: count(value.materialCount),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function parseAdminUser(value: unknown): AdminUser {
  if (!record(value)) throw new Error('invalid');
  if (
    typeof value.role !== 'string' ||
    !Object.hasOwn(roleLabels, value.role) ||
    typeof value.isActive !== 'boolean' ||
    !isDate(value.createdAt) ||
    !isDate(value.updatedAt)
  )
    throw new Error('invalid');
  return {
    id: parseUuid(value.id),
    email: text(value.email),
    displayName: text(value.displayName),
    role: value.role as AuthUser['role'],
    isActive: value.isActive,
    membershipCount: count(value.membershipCount),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function parseAdminMember(value: unknown): AdminMember {
  if (!record(value) || !isDate(value.createdAt)) throw new Error('invalid');
  return {
    userId: parseUuid(value.userId),
    institutionId: parseUuid(value.institutionId),
    email: text(value.email),
    displayName: text(value.displayName),
    createdAt: value.createdAt,
  };
}

function parseAdminMaterial(value: unknown): AdminMaterial {
  if (
    !record(value) ||
    typeof value.status !== 'string' ||
    !Object.hasOwn(statusLabels, value.status)
  )
    throw new Error('invalid');
  return {
    ...parseMaterialFields(value),
    status: value.status as MaterialStatus,
  };
}

function parseAdminReservation(value: unknown): AdminReservation {
  if (!record(value)) throw new Error('invalid');
  if (
    typeof value.status !== 'string' ||
    !Object.hasOwn(reservationStatusLabels, value.status) ||
    !isDate(value.expiresAt) ||
    !isDate(value.createdAt) ||
    !(value.completedAt === null || isDate(value.completedAt))
  )
    throw new Error('invalid');
  return {
    id: parseUuid(value.id),
    status: value.status as AdminReservation['status'],
    materialId: parseUuid(value.materialId),
    material: parseAdminMaterial(value.material),
    institutionId: parseUuid(value.institutionId),
    studentId: parseUuid(value.studentId),
    expiresAt: value.expiresAt,
    completedAt: value.completedAt,
    createdAt: value.createdAt,
  };
}

function parseAdminAuditEvent(value: unknown): AdminAuditEvent {
  if (!record(value) || !isDate(value.createdAt)) throw new Error('invalid');
  return {
    id: parseUuid(value.id),
    action: text(value.action),
    actorId: optionalUuid(value.actorId),
    institutionId: optionalUuid(value.institutionId),
    materialId: optionalUuid(value.materialId),
    reservationId: optionalUuid(value.reservationId),
    metadata: value.metadata,
    createdAt: value.createdAt,
  };
}

function queryString(query: Record<string, unknown>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value !== undefined && value !== '' && value !== null)
      params.set(key, String(value));
  return params.toString();
}

function pageQuery(
  path: string,
  { page = 1, pageSize = 20, ...rest }: Record<string, unknown>,
) {
  return path + '?' + queryString({ ...rest, page, pageSize });
}

export function listAdminInstitutions(
  query: AdminInstitutionQuery = {},
  signal?: AbortSignal,
) {
  return requestOperation(
    pageQuery('admin/institutions', { ...query }),
    { signal },
    (value) => {
      const result = parsePage(value, parseAdminInstitution);
      if (
        result.items.some(
          (item) => query.status && item.status !== query.status,
        )
      )
        throw new Error('invalid');
      return result;
    },
    200,
  );
}

/** Every admin institution across all pages (filter dropdowns). */
export async function listAllAdminInstitutions(
  signal?: AbortSignal,
): Promise<AdminInstitution[]> {
  const items: AdminInstitution[] = [];
  for (let page = 1; ; page++) {
    const result = await listAdminInstitutions({ page, pageSize: 50 }, signal);
    items.push(...result.items);
    if (!result.items.length || page * result.pageSize >= result.total)
      return items;
  }
}

/** Paged lookup for a single admin institution (no single-get endpoint). */
export async function findAdminInstitution(
  id: string,
  signal?: AbortSignal,
): Promise<AdminInstitution | null> {
  const uuid = parseUuid(id);
  for (let page = 1; ; page++) {
    const result = await listAdminInstitutions(
      { page, pageSize: 50 },
      signal,
    );
    const found = result.items.find((item) => item.id === uuid);
    if (found) return found;
    if (!result.items.length || page * result.pageSize >= result.total)
      return null;
  }
}

function institutionMutation(
  id: string,
  action: string,
  signal?: AbortSignal,
  body?: object,
) {
  return requestOperation(
    'admin/institutions/' + parseUuid(id) + '/' + action,
    postOperation(signal, body),
    parseAdminInstitution,
    200,
  );
}

export function approveInstitution(id: string, signal?: AbortSignal) {
  return institutionMutation(id, 'approve', signal);
}

export function rejectInstitution(
  id: string,
  reason: string,
  signal?: AbortSignal,
) {
  return institutionMutation(id, 'reject', signal, { reason });
}

export function setInstitutionActive(
  id: string,
  active: boolean,
  signal?: AbortSignal,
) {
  return institutionMutation(id, active ? 'activate' : 'deactivate', signal);
}

export function listInstitutionMembers(id: string, signal?: AbortSignal) {
  return requestOperation(
    'admin/institutions/' + parseUuid(id) + '/members',
    { signal },
    (value) => {
      if (!Array.isArray(value)) throw new Error('invalid');
      return value.map(parseAdminMember);
    },
    200,
  );
}

export function assignInstitutionMember(
  id: string,
  userId: string,
  signal?: AbortSignal,
) {
  return requestOperation(
    'admin/institutions/' + parseUuid(id) + '/members',
    postOperation(signal, { userId: parseUuid(userId) }),
    parseAdminMember,
    201,
  );
}

export function revokeInstitutionMember(
  id: string,
  userId: string,
  signal?: AbortSignal,
) {
  return requestOperation(
    'admin/institutions/' +
      parseUuid(id) +
      '/members/' +
      parseUuid(userId) +
      '/revoke',
    postOperation(signal),
    () => undefined,
    204,
  );
}

export function listAdminUsers(
  query: AdminUserQuery = {},
  signal?: AbortSignal,
) {
  return requestOperation(
    pageQuery('admin/users', { ...query }),
    { signal },
    (value) => {
      const result = parsePage(value, parseAdminUser);
      if (
        result.items.some((item) => query.role && item.role !== query.role)
      )
        throw new Error('invalid');
      return result;
    },
    200,
  );
}

export function setUserRole(
  id: string,
  role: 'STUDENT' | 'STAFF',
  signal?: AbortSignal,
) {
  return requestOperation(
    'admin/users/' + parseUuid(id) + '/role',
    postOperation(signal, { role }),
    parseAdminUser,
    200,
  );
}

export function setUserActive(
  id: string,
  active: boolean,
  signal?: AbortSignal,
) {
  return requestOperation(
    'admin/users/' + parseUuid(id) + (active ? '/activate' : '/deactivate'),
    postOperation(signal),
    parseAdminUser,
    200,
  );
}

export function listAdminMaterials(
  query: AdminMaterialQuery = {},
  signal?: AbortSignal,
) {
  return requestOperation(
    pageQuery('admin/materials', { ...query }),
    { signal },
    (value) => {
      const result = parsePage(value, parseAdminMaterial);
      if (
        result.items.some(
          (item) => query.status && item.status !== query.status,
        )
      )
        throw new Error('invalid');
      return result;
    },
    200,
  );
}

export function listAdminReservations(
  query: AdminReservationQuery = {},
  signal?: AbortSignal,
) {
  return requestOperation(
    pageQuery('admin/reservations', { ...query }),
    { signal },
    (value) => {
      const result = parsePage(value, parseAdminReservation);
      if (
        result.items.some(
          (item) => query.status && item.status !== query.status,
        )
      )
        throw new Error('invalid');
      return result;
    },
    200,
  );
}

export function listAdminAuditEvents(
  query: AdminAuditQuery = {},
  signal?: AbortSignal,
) {
  return requestOperation(
    pageQuery('admin/audit-events', { ...query }),
    { signal },
    (value) => parsePage(value, parseAdminAuditEvent),
    200,
  );
}

export type InstitutionRegistration = {
  name: string;
  publicAddress: string;
  pickupInstructions: string;
};

export function registerInstitution(
  input: InstitutionRegistration,
  signal?: AbortSignal,
): Promise<Institution> {
  return requestOperation(
    'institutions',
    postOperation(signal, {
      name: input.name,
      publicAddress: input.publicAddress,
      pickupInstructions: input.pickupInstructions,
    }),
    parseInstitution,
    201,
  );
}

export function adminMessage(error: unknown): string {
  const status = error instanceof OperationError ? error.status : 0;
  switch (status) {
    case 400:
      return 'Revise os dados informados e tente novamente.';
    case 401:
      return 'Sua sessão expirou. Entre novamente para continuar.';
    case 403:
      return 'Sua conta não tem acesso à administração.';
    case 404:
      return 'Este registro está indisponível. Atualize a consulta.';
    case 409:
      return 'A situação deste registro mudou. Atualize a lista para conferir.';
    case 429:
      return 'Muitas solicitações. Aguarde um momento e tente novamente.';
    default:
      return 'Não foi possível concluir a solicitação. Confira a conexão e tente novamente.';
  }
}
