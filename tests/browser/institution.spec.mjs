import { expect, test } from '@playwright/test';

const north = {
  id: '9825c2f3-9b29-41df-b92c-03f78ec8a810',
  name: 'Biblioteca Norte',
  publicAddress: 'Alameda de Teste, 10',
  pickupInstructions: 'Procure o balcão.',
};
const south = {
  ...north,
  id: '51e739bc-d744-49a3-9aa8-8e64f3835831',
  name: 'Biblioteca Sul',
};
const user = {
  id: '672abf72-5df3-420b-855c-76f964a5e6ae',
  email: 'equipe@example.invalid',
  displayName: 'Equipe de teste',
  role: 'STAFF',
};

function pending(institution, id, title) {
  return {
    institution,
    id,
    title,
    description: 'Exemplar para atividades de leitura.',
    category: 'BOOK',
    condition: 'GOOD',
    imageUrl: null,
    status: 'PENDING_RECEIPT',
    createdAt: '2026-11-19T16:00:00Z',
    updatedAt: '2026-11-19T16:00:00Z',
    receivedAt: null,
    rejectReason: null,
  };
}

async function staffSession(page, handler) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.slice('/api/v1'.length);
    if (path === '/auth/refresh') {
      return route.fulfill({
        json: { user, accessToken: 'synthetic-staff', expiresIn: 900 },
      });
    }
    expect(route.request().headers().authorization).toBe(
      'Bearer synthetic-staff',
    );
    if (path === '/me/institutions') {
      return route.fulfill({
        json: { items: [north, south], page: 1, pageSize: 50, total: 2 },
      });
    }
    return handler(route, path, url.searchParams);
  });
}

test('staff confirm physical receipt and give a reason before rejecting a donation', async ({
  page,
}) => {
  const atlas = pending(
    north,
    '4912e501-d578-47c0-bf62-009bc1109d57',
    'Atlas das aves',
  );
  const notes = pending(
    north,
    '0bf41fdb-feb3-49d4-9129-190bf1afd24d',
    'Notas de campo',
  );
  const items = [atlas, notes];
  const posts = [];
  const base = '/institutions/' + north.id + '/materials';
  await staffSession(page, async (route, path, params) => {
    if (route.request().method() === 'GET') {
      expect(path).toBe(base);
      expect(params.get('status')).toBe('PENDING_RECEIPT');
      const available = items.filter(
        (item) => item.status === 'PENDING_RECEIPT',
      );
      return route.fulfill({
        json: {
          items: available,
          page: 1,
          pageSize: 12,
          total: available.length,
        },
      });
    }
    expect(route.request().method()).toBe('POST');
    posts.push(path);
    if (path === base + '/' + atlas.id + '/receive') {
      atlas.status = 'AVAILABLE';
      atlas.receivedAt = atlas.updatedAt;
      return route.fulfill({ json: atlas });
    }
    expect(path).toBe(base + '/' + notes.id + '/reject');
    expect(route.request().postDataJSON()).toEqual({
      reason: 'Faltam páginas.',
    });
    notes.status = 'REJECTED';
    notes.rejectReason = 'Faltam páginas.';
    return route.fulfill({ json: notes });
  });
  await page.goto('/instituicao/recebimentos');
  const receive = page
    .getByRole('listitem')
    .filter({ hasText: atlas.title })
    .getByRole('button', { name: 'Receber' });
  await receive.click();
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Confirmar recebimento' }).click();
  await expect(dialog).toBeVisible();
  expect(posts).toHaveLength(0);
  await page.keyboard.press('Escape');
  await expect(receive).toBeFocused();
  await receive.click();
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Confirmar recebimento' }).click();
  await expect(
    page.getByText('Recebimento confirmado.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: atlas.title })).toHaveCount(0);
  await page.getByRole('button', { name: 'Recusar' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Motivo da recusa').fill('   ');
  await dialog.getByRole('button', { name: 'Confirmar recusa' }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  expect(posts).toHaveLength(1);
  await dialog.getByLabel('Motivo da recusa').fill('Faltam páginas.');
  await dialog.getByRole('button', { name: 'Confirmar recusa' }).click();
  await expect(
    page.getByText('Nenhuma doação aguardando recebimento.'),
  ).toBeVisible();
  expect(posts).toHaveLength(2);
});

test('switching institutions discards an older stock response and rejects an unknown scope', async ({
  page,
}) => {
  const oldBook = pending(
    north,
    '4912e501-d578-47c0-bf62-009bc1109d57',
    'Acervo do Norte',
  );
  const newBook = pending(
    south,
    '0bf41fdb-feb3-49d4-9129-190bf1afd24d',
    'Acervo do Sul',
  );
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const firstPath = '/institutions/' + north.id + '/materials';
  const secondPath = '/institutions/' + south.id + '/materials';
  const requests = new Set();
  await staffSession(page, async (route, path) => {
    requests.add(path);
    expect([firstPath, secondPath]).toContain(path);
    if (path === firstPath) await gate;
    return route.fulfill({
      json: {
        items: [path === firstPath ? oldBook : newBook],
        page: 1,
        pageSize: 12,
        total: 1,
      },
    });
  });
  const canceled = page.waitForEvent('requestfailed', {
    predicate: (request) => new URL(request.url()).pathname.endsWith(firstPath),
  });
  const first = page.waitForRequest((request) =>
    new URL(request.url()).pathname.endsWith(firstPath),
  );
  await page.goto('/instituicao/estoque');
  await first;
  await page.getByLabel('Instituição', { exact: true }).selectOption(south.id);
  await expect(
    page.getByRole('heading', { name: newBook.title }),
  ).toBeVisible();
  release();
  await canceled;
  await expect(page.getByRole('heading', { name: oldBook.title })).toHaveCount(
    0,
  );
  await page.goto('/instituicao/estoque?instituicao=sem-vinculo');
  await expect(page.getByRole('alert')).toContainText('Você não tem acesso');
  await expect(page.getByRole('heading', { name: newBook.title })).toHaveCount(
    0,
  );
  expect([...requests].sort()).toEqual([firstPath, secondPath].sort());
});
