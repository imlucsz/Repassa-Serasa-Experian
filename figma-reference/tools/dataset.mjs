// Fictional dataset + API router for reference screenshots.
// All data is synthetic (example.invalid emails, fictional institutions).

const I1 = '84f38c09-2ceb-4fa4-8c38-d513bf8bad10';
const I2 = '39ea38aa-78f3-4870-b586-4c51ef2ab200';

export const institutions = [
  {
    id: I1,
    name: 'Instituto Folha Nova',
    publicAddress: 'Alameda das Folhas, 24 — Vila Mariana, São Paulo/SP',
    pickupInstructions: 'Apresente seu código na biblioteca do instituto, de segunda a sexta, das 9h às 17h.',
  },
  {
    id: I2,
    name: 'Centro Comunitário Semente',
    publicAddress: 'Rua do Bosque, 310 — Santo Amaro, São Paulo/SP',
    pickupInstructions: 'Procure a secretaria do centro e informe o código de retirada.',
  },
];

export const users = {
  STUDENT: {
    id: '84f38c09-2ceb-4fa4-8c38-d513bf8bad11',
    displayName: 'Ana Beatriz Lima',
    email: 'ana.aluna@example.invalid',
    role: 'STUDENT',
  },
  STAFF: {
    id: '84f38c09-2ceb-4fa4-8c38-d513bf8bad12',
    displayName: 'Marta Souza',
    email: 'funcionaria.marta@example.invalid',
    role: 'STAFF',
  },
};

function material(n, over = {}) {
  const base = {
    description: '',
    category: 'BOOK',
    condition: 'GOOD',
    imageUrl: null,
    status: 'AVAILABLE',
    institution: institutions[0],
    createdAt: '2026-10-2' + (n % 9) + 'T12:00:00Z',
  };
  return {
    id: '39ea38aa-78f3-4870-b586-0000000000' + String(n).padStart(2, '0'),
    ...base,
    ...over,
  };
}

export const catalog = [
  material(1, { title: 'Botânica ilustrada', description: 'Guia ilustrado de botânica para o ensino médio, com exercícios.', condition: 'GOOD' }),
  material(2, { title: 'Matemática: fundamentos', description: 'Teoria e exercícios resolvidos de álgebra e geometria.', condition: 'LIKE_NEW' }),
  material(3, { title: 'Atlas geográfico do Brasil', description: 'Mapas físicos, políticos e econômicos atualizados.', condition: 'FAIR', institution: institutions[1] }),
  material(4, { title: 'História do Brasil colonial', description: 'Coleção didática com fontes históricas comentadas.', condition: 'GOOD' }),
  material(5, { title: 'Caderno pautado 96 folhas', description: 'Caderno universitário pautado, pouco uso.', category: 'NOTEBOOK', condition: 'LIKE_NEW', institution: institutions[1] }),
  material(6, { title: 'Kit régua e esquadro', description: 'Jogo de réguas, esquadros e compasso para desenho técnico.', category: 'SUPPLIES', condition: 'GOOD' }),
  material(7, { title: 'Química orgânica essencial', description: 'Introdução às funções orgânicas com exercícios.', condition: 'GOOD', institution: institutions[1] }),
  material(8, { title: 'Física para vestibular', description: 'Mecânica, eletricidade e óptica com questões comentadas.', condition: 'FAIR' }),
  material(9, { title: 'Gramática completa', description: 'Gramática de referência da língua portuguesa.', condition: 'GOOD' }),
  material(10, { title: 'Astronomia: o céu e as estrelas', description: 'Introdução ilustrada à observação do céu.', condition: 'LIKE_NEW', institution: institutions[1] }),
  material(11, { title: 'Formas geométricas em madeira', description: 'Conjunto de sólidos geométricos para aulas de matemática.', category: 'SUPPLIES', condition: 'GOOD' }),
  material(12, { title: 'Literatura juvenil: antologia', description: 'Antologia de contos brasileiros para o fundamental II.', condition: 'GOOD' }),
];

export const donations = [
  material(21, { title: 'Botânica ilustrada', description: 'Guia ilustrado de botânica.', status: 'AVAILABLE', receivedAt: '2026-10-21T14:00:00Z', updatedAt: '2026-10-21T14:00:00Z', rejectReason: null }),
  material(22, { title: 'Caderno pautado 96 folhas', description: 'Caderno universitário pouco usado.', category: 'NOTEBOOK', status: 'PENDING_RECEIPT', receivedAt: null, updatedAt: '2026-11-18T09:30:00Z', rejectReason: null, institution: institutions[1] }),
  material(23, { title: 'Atlas geográfico do Brasil', description: 'Edição 2023, capa dura.', status: 'REJECTED', receivedAt: null, updatedAt: '2026-11-12T16:20:00Z', rejectReason: 'Páginas soltas e mofo — material impróprio para circulação.' }),
  material(24, { title: 'Kit régua e esquadro', description: 'Jogo completo de desenho técnico.', category: 'SUPPLIES', status: 'DELIVERED', receivedAt: '2026-09-30T11:00:00Z', updatedAt: '2026-10-04T15:40:00Z', rejectReason: null }),
  material(25, { title: 'Física para vestibular', description: 'Volume único com exercícios.', status: 'CANCELED', receivedAt: null, updatedAt: '2026-10-02T10:00:00Z', rejectReason: null }),
];

export const stock = [
  material(31, { title: 'Botânica ilustrada', description: 'Guia ilustrado.', status: 'AVAILABLE', receivedAt: '2026-10-21T14:00:00Z', updatedAt: '2026-10-21T14:00:00Z', rejectReason: null }),
  material(32, { title: 'Caderno pautado 96 folhas', description: 'Pouco uso.', category: 'NOTEBOOK', status: 'PENDING_RECEIPT', receivedAt: null, updatedAt: '2026-11-18T09:30:00Z', rejectReason: null }),
  material(33, { title: 'Gramática completa', description: 'Referência gramatical.', status: 'RESERVED', receivedAt: '2026-10-10T13:00:00Z', updatedAt: '2026-11-19T08:10:00Z', rejectReason: null }),
  material(34, { title: 'Matemática: fundamentos', description: 'Teoria e exercícios.', status: 'DELIVERED', receivedAt: '2026-09-12T10:00:00Z', updatedAt: '2026-09-18T11:30:00Z', rejectReason: null }),
  material(35, { title: 'Kit réguas quebradas', description: 'Conjunto incompleto.', category: 'SUPPLIES', status: 'REJECTED', receivedAt: null, updatedAt: '2026-11-05T14:00:00Z', rejectReason: 'Peças quebradas.' }),
];

export const reservation = {
  id: '5c68d97f-8aa2-4b60-b745-9a1b3d50e21c',
  status: 'ACTIVE',
  material: { id: catalog[0].id },
  expiresAt: '2026-11-25T23:59:59Z',
  createdAt: '2026-11-20T14:32:00Z',
  completedAt: null,
  pickupCode: 'K7N2-P4XQ-9M3B',
};

function page(items, url) {
  const p = Number(url.searchParams.get('page') || 1);
  const pageSize = Number(url.searchParams.get('pageSize') || 20);
  return { items: items.slice((p - 1) * pageSize, p * pageSize), page: p, pageSize, total: items.length };
}

// Route handler for the /api/v1 interception. `role` selects refresh identity.
export function apiRouter(role) {
  return async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.slice('/api/v1'.length);
    const json = (body, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const user = role ? users[role] : null;

    if (path === '/auth/refresh') {
      if (role === 'SESSION_ERROR') return json({}, 503);
      return user ? json({ user, accessToken: 'figma-ref', expiresIn: 900 }) : json({}, 401);
    }
    if (path === '/auth/login' || path === '/auth/register')
      return json({ user: users.STUDENT, accessToken: 'figma-ref', expiresIn: 900 }, 201);
    if (path === '/auth/logout') return route.fulfill({ status: 204 });
    if (path === '/me') return user ? json(user) : json({}, 401);
    if (path === '/institutions' && request.method() === 'GET')
      return json(page(institutions, url));
    if (path === '/materials') {
      const q = (url.searchParams.get('q') || '').toLowerCase();
      const cat = url.searchParams.get('category');
      const inst = url.searchParams.get('institutionId');
      let items = catalog;
      if (q) items = items.filter((m) => (m.title + m.description).toLowerCase().includes(q));
      if (cat) items = items.filter((m) => m.category === cat);
      if (inst) items = items.filter((m) => m.institution.id === inst);
      return json(page(items, url));
    }
    const matMatch = path.match(/^\/materials\/([\da-f-]{36})$/);
    if (matMatch && request.method() === 'GET') {
      const found = catalog.find((m) => m.id === matMatch[1]);
      return found ? json(found) : json({ code: 'NOT_FOUND', message: 'Material não encontrado.' }, 404);
    }
    const resMatch = path.match(/^\/materials\/([\da-f-]{36})\/reservations$/);
    if (resMatch && request.method() === 'POST')
      return json({ ...reservation, material: { id: resMatch[1] } }, 201);
    if (path === '/me/reservations')
      return json(page([reservation], url));
    if (path === '/me/donations' && request.method() === 'GET')
      return json(page(donations, url));
    if (path === '/me/donations' && request.method() === 'POST')
      return json({ ...donations[1], ...JSON.parse(request.postData() || '{}'), status: 'PENDING_RECEIPT' }, 201);
    if (path === '/me/institutions')
      return json(page(role === 'STAFF' ? institutions : [], url));
    const instMat = path.match(/^\/institutions\/([\da-f-]{36})\/materials$/);
    if (instMat && request.method() === 'GET') {
      const status = url.searchParams.get('status');
      const items = status ? stock.filter((m) => m.status === status) : stock;
      return json(page(items, url));
    }
    if (path === '/uploads') return json({ uploadId: '84f38c09-2ceb-4fa4-8c38-d513bf8bad99' }, 201);
    if (path === '/donations' && request.method() === 'POST') {
      const body = JSON.parse(request.postData() || '{}');
      const inst = institutions.find((i) => i.id === body.institutionId) || institutions[0];
      return json(
        { ...donations[1], ...body, institution: inst, status: 'PENDING_RECEIPT' },
        201,
      );
    }
    return json({ code: 'NOT_FOUND', message: 'not mocked: ' + path }, 404);
  };
}
