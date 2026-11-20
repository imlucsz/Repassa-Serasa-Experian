import {
  CatalogError,
  type Category,
  type Condition,
  type Institution,
  type Material,
  type MaterialQuery,
} from './contract.ts';

const institutions: Institution[] = [
  {
    id: '84f38c09-2ceb-4fa4-8c38-d513bf8bad10',
    name: 'Instituto Folha Nova',
    publicAddress: 'Alameda das Folhas, 24',
    pickupInstructions: 'Apresente seu código na biblioteca do instituto.',
  },
  {
    id: '84f38c09-2ceb-4fa4-8c38-d513bf8bad11',
    name: 'Casa de Estudos Ipê',
    publicAddress: 'Travessa do Ipê, 46',
    pickupInstructions: 'Procure a equipe de atendimento na entrada principal.',
  },
];

function fixture(
  index: number,
  title: string,
  description: string,
  category: Category,
  condition: Condition,
  institution: Institution,
): Material {
  return {
    id: '39ea38aa-78f3-4870-b586-' + String(index).padStart(12, '0'),
    title,
    description,
    category,
    condition,
    institution,
    status: 'AVAILABLE',
    imageUrl: null,
    createdAt: '2026-11-10T12:00:00Z',
  };
}

const materials = [
  fixture(
    1,
    'Botânica ilustrada',
    'Um guia de folhas, flores e sementes para reconhecer as plantas no caminho de casa.',
    'BOOK',
    'GOOD',
    institutions[0],
  ),
  fixture(
    2,
    'Atlas celeste',
    'Mapas das constelações e exercícios de observação do céu no hemisfério sul.',
    'BOOK',
    'LIKE_NEW',
    institutions[1],
  ),
  fixture(
    3,
    'Estudos da forma',
    'Ritmo, cor e composição em exercícios de desenho com figuras geométricas.',
    'BOOK',
    'GOOD',
    institutions[0],
  ),
  fixture(
    4,
    'Cartografia do Brasil',
    'Mapas de relevo, rios e biomas para estudar as paisagens brasileiras.',
    'BOOK',
    'FAIR',
    institutions[1],
  ),
  fixture(
    5,
    'Caderno de campo',
    'Caderno pautado com espaço para esboços e registros de observação.',
    'NOTEBOOK',
    'LIKE_NEW',
    institutions[0],
  ),
  fixture(
    6,
    'Instrumentos de desenho',
    'Estojo com régua, esquadros e compasso para as aulas de geometria.',
    'SUPPLIES',
    'GOOD',
    institutions[1],
  ),
];

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

export const mockCatalog = {
  async listMaterials(query: MaterialQuery = {}, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const { page = 1, pageSize = 20 } = query;
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 50 ||
      (query.q?.length ?? 0) > 120
    ) {
      throw new CatalogError(400, 'Confira os filtros do catálogo.');
    }
    const search = normalize(query.q ?? '');
    const matches = materials.filter(
      (material) =>
        (!query.category || material.category === query.category) &&
        (!query.institutionId ||
          material.institution.id === query.institutionId) &&
        normalize(material.title + ' ' + material.description).includes(search),
    );
    const offset = (page - 1) * pageSize;
    return {
      items: matches.slice(offset, offset + pageSize),
      page,
      pageSize,
      total: matches.length,
    };
  },

  async getMaterial(id: string, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const material = materials.find((item) => item.id === id);
    if (!material) throw new CatalogError(404, 'Material indisponível.');
    return material;
  },

  async listInstitutions(signal?: AbortSignal) {
    signal?.throwIfAborted();
    return institutions.slice();
  },
};
