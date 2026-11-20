export const categoryLabels = {
  BOOK: 'Livros',
  NOTEBOOK: 'Cadernos',
  SUPPLIES: 'Materiais escolares',
  OTHER: 'Outros',
} as const;

export const conditionLabels = {
  LIKE_NEW: 'Como novo',
  GOOD: 'Em bom estado',
  FAIR: 'Com marcas de uso',
} as const;

export type Category = keyof typeof categoryLabels;
export type Condition = keyof typeof conditionLabels;

export interface Institution {
  id: string;
  name: string;
  publicAddress: string;
  pickupInstructions: string;
}

/** Public catalog endpoints expose only items available for collection. */
export interface Material {
  id: string;
  title: string;
  description: string;
  category: Category;
  condition: Condition;
  imageUrl: string | null;
  status: 'AVAILABLE';
  institution: Institution;
  createdAt: string;
}

export interface MaterialQuery {
  q?: string;
  category?: Category;
  institutionId?: string;
  page?: number;
  pageSize?: number;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export type MaterialPage = Page<Material>;

export class CatalogError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'CatalogError';
    this.status = status;
  }
}

function invalidResponse(): never {
  throw new CatalogError(
    502,
    'A resposta do catálogo é inválida. Tente novamente.',
  );
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    invalidResponse();
  return value as Record<string, unknown>;
}

function string(value: unknown): string {
  if (typeof value !== 'string') invalidResponse();
  return value;
}

function uuid(value: unknown): string {
  const id = string(value);
  if (!/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(id))
    invalidResponse();
  return id;
}

function integer(value: unknown, minimum: number): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < minimum
  )
    invalidResponse();
  return value;
}

export function parseInstitution(input: unknown): Institution {
  const item = record(input);
  return {
    id: uuid(item.id),
    name: string(item.name),
    publicAddress: string(item.publicAddress),
    pickupInstructions: string(item.pickupInstructions),
  };
}

function isKey<T extends object>(value: unknown, labels: T): value is keyof T {
  return typeof value === 'string' && Object.hasOwn(labels, value);
}

export function parseMaterial(input: unknown): Material {
  const item = record(input);
  if (
    !isKey(item.category, categoryLabels) ||
    !isKey(item.condition, conditionLabels)
  )
    invalidResponse();
  if (item.status !== 'AVAILABLE') invalidResponse();
  const createdAt = string(item.createdAt);
  if (!Number.isFinite(Date.parse(createdAt))) invalidResponse();
  const imageUrl = item.imageUrl === null ? null : string(item.imageUrl);
  if (imageUrl !== null && !/^https?:\/\//i.test(imageUrl)) invalidResponse();
  return {
    id: uuid(item.id),
    title: string(item.title),
    description: string(item.description),
    category: item.category,
    condition: item.condition,
    imageUrl,
    status: item.status,
    institution: parseInstitution(item.institution),
    createdAt,
  };
}

export function parsePage<T>(
  input: unknown,
  parseItem: (value: unknown) => T,
): Page<T> {
  const result = record(input);
  const pageSize = integer(result.pageSize, 1);
  if (
    pageSize > 50 ||
    !Array.isArray(result.items) ||
    result.items.length > pageSize
  )
    invalidResponse();
  return {
    page: integer(result.page, 1),
    pageSize,
    total: integer(result.total, 0),
    items: result.items.map(parseItem),
  };
}
