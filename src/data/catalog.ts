import {
  CatalogError,
  parseInstitution,
  parseMaterial,
  parsePage,
  type Institution,
  type Material,
  type MaterialPage,
  type MaterialQuery,
} from './contract.ts';

export { CatalogError, categoryLabels, conditionLabels } from './contract.ts';
export type {
  Category,
  Condition,
  Institution,
  Material,
  MaterialPage,
  MaterialQuery,
} from './contract.ts';

export const isDemo = import.meta.env?.VITE_DATA_MODE === 'mock';

async function read(path: string, signal?: AbortSignal): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch('/api/v1/' + path, {
      signal,
      headers: { Accept: 'application/json' },
    });
  } catch (error) {
    signal?.throwIfAborted();
    if (error instanceof TypeError)
      throw new CatalogError(0, 'Não foi possível conectar ao catálogo.');
    throw error;
  }
  if (!response.ok) {
    const messages: Record<number, string> = {
      400: 'Confira os filtros do catálogo.',
      401: 'É necessário entrar para acessar este conteúdo.',
      403: 'Você não tem acesso a este conteúdo.',
      404: 'Material indisponível.',
      409: 'Este material mudou de situação. Atualize o catálogo.',
      429: 'Muitas consultas. Aguarde um momento e tente novamente.',
    };
    throw new CatalogError(
      response.status,
      messages[response.status] ??
        'O catálogo está indisponível. Tente novamente.',
    );
  }
  try {
    return await response.json();
  } catch {
    signal?.throwIfAborted();
    throw new CatalogError(
      502,
      'A resposta do catálogo é inválida. Tente novamente.',
    );
  }
}

export async function listMaterials(
  query: MaterialQuery = {},
  signal?: AbortSignal,
): Promise<MaterialPage> {
  if (isDemo)
    return (await import('./mockCatalog.ts')).mockCatalog.listMaterials(
      query,
      signal,
    );
  const params = new URLSearchParams();
  for (const key of [
    'q',
    'category',
    'institutionId',
    'page',
    'pageSize',
  ] as const) {
    const value = query[key];
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const path = params.size ? 'materials?' + params : 'materials';
  return parsePage(await read(path, signal), parseMaterial);
}

export async function getMaterial(
  id: string,
  signal?: AbortSignal,
): Promise<Material> {
  if (isDemo)
    return (await import('./mockCatalog.ts')).mockCatalog.getMaterial(
      id,
      signal,
    );
  return parseMaterial(
    await read('materials/' + encodeURIComponent(id), signal),
  );
}

export async function listInstitutions(
  signal?: AbortSignal,
): Promise<Institution[]> {
  if (isDemo)
    return (await import('./mockCatalog.ts')).mockCatalog.listInstitutions(
      signal,
    );
  const items: Institution[] = [];
  let page = 1;
  for (;;) {
    const data = parsePage(
      await read('institutions?page=' + page + '&pageSize=50', signal),
      parseInstitution,
    );
    if (data.page !== page)
      throw new CatalogError(502, 'A paginação das instituições é inválida.');
    items.push(...data.items);
    if (data.items.length === 0 || page * data.pageSize >= data.total)
      return items;
    page++;
  }
}
