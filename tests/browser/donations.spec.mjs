import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const institution = {
  id: '84f38c09-2ceb-4fa4-8c38-d513bf8bad10',
  name: 'Instituto Folha Nova',
  publicAddress: 'Alameda das Folhas, 24',
  pickupInstructions: 'Apresente o código de retirada.',
};
const itemId = '39ea38aa-78f3-4870-b586-000000000001';
const uploadId = '39ea38aa-78f3-4870-b586-000000000377';
const now = '2026-11-19T14:00:00Z';
const material = {
  id: itemId,
  title: 'Atlas de geografia',
  description: 'Atlas em bom estado para uso escolar.',
  category: 'BOOK',
  condition: 'GOOD',
  institution,
  imageUrl: null,
  status: 'PENDING_RECEIPT',
  receivedAt: null,
  rejectReason: null,
  createdAt: now,
  updatedAt: now,
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/auth/refresh', (route) =>
    route.fulfill({
      json: {
        user: {
          id: '84f38c09-2ceb-4fa4-8c38-d513bf8bad11',
          displayName: 'Estudante de teste',
          email: 'estudante@example.invalid',
          role: 'STUDENT',
        },
        accessToken: 'test_browser_session',
        expiresIn: 900,
      },
    }),
  );
});

test('donation keeps the form after upload failure and can be canceled after confirmation', async ({
  page,
}) => {
  const requests = [];
  let donation;
  await page.route('**/api/v1/institutions?*', (route) =>
    route.fulfill({
      json: { items: [institution], page: 1, pageSize: 50, total: 1 },
    }),
  );
  await page.route('**/api/v1/uploads', (route) => {
    requests.push('upload');
    expect(route.request().headers()['content-type']).toContain(
      'multipart/form-data',
    );
    return requests.length === 1
      ? route.fulfill({ status: 429, json: { code: 'RATE_LIMITED' } })
      : route.fulfill({ status: 201, json: { uploadId } });
  });
  await page.route('**/api/v1/donations', (route) => {
    requests.push('create');
    expect(route.request().postDataJSON()).toEqual({
      title: material.title,
      description: material.description,
      category: 'BOOK',
      condition: 'GOOD',
      institutionId: institution.id,
      uploadId,
    });
    donation = { ...material };
    return route.fulfill({ status: 201, json: donation });
  });
  await page.route('**/api/v1/me/donations?*', (route) =>
    route.fulfill({
      json: {
        items: donation ? [donation] : [],
        page: 1,
        pageSize: 10,
        total: donation ? 1 : 0,
      },
    }),
  );
  await page.route('**/api/v1/donations/' + itemId + '/cancel', (route) => {
    requests.push('cancel');
    donation.status = 'CANCELED';
    return route.fulfill({ json: donation });
  });

  await page.goto('/doar');
  await page.getByLabel('Título do material').fill(material.title);
  await page
    .getByLabel('Descrição', { exact: true })
    .fill(material.description);
  await page.getByLabel('Categoria', { exact: true }).selectOption('BOOK');
  await page.getByLabel('Condição', { exact: true }).selectOption('GOOD');
  await page
    .getByLabel('Instituição', { exact: true })
    .selectOption(institution.id);

  const photo = page.getByLabel('Foto do material (opcional)');
  await photo.setInputFiles({
    name: 'amostra.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('x'),
  });
  await expect(page.getByRole('alert')).toContainText('Escolha uma foto');
  await page.getByRole('button', { name: 'Continuar sem foto' }).click();
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEgwH/pCzGuwAAAABJRU5ErkJggg==',
    'base64',
  );
  await photo.setInputFiles({
    name: 'amostra.png',
    mimeType: 'image/png',
    buffer: png,
  });
  await expect(page.getByAltText('Prévia da foto selecionada')).toBeVisible();

  const submit = page.getByRole('button', { name: 'Cadastrar doação' });
  await submit.click();
  await expect(page.getByRole('alert')).toContainText('Muitas solicitações');
  await expect(page.getByLabel('Título do material')).toHaveValue(
    material.title,
  );
  await expect(page.getByLabel('Descrição', { exact: true })).toHaveValue(
    material.description,
  );
  await expect(page.getByAltText('Prévia da foto selecionada')).toBeVisible();
  await submit.click();
  await expect(
    page.getByText('Aguardando entrega', { exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Ver minhas doações' }).click();

  await expect(page.getByText(institution.pickupInstructions)).toHaveCount(0);
  const cancel = page.getByRole('button', { name: 'Cancelar doação' });
  await cancel.click();
  await expect(
    page.getByRole('button', { name: 'Manter doação' }),
  ).toBeFocused();
  await page.getByRole('button', { name: 'Manter doação' }).press('Enter');
  await expect(cancel).toBeFocused();
  expect(requests).toEqual(['upload', 'upload', 'create']);
  await cancel.click();
  await page.getByRole('button', { name: 'Confirmar cancelamento' }).click();
  await expect(
    page.getByText('Doação cancelada.', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText('Cancelado', { exact: true })).toBeVisible();
  await expect(cancel).toHaveCount(0);
  expect(requests).toEqual(['upload', 'upload', 'create', 'cancel']);
});

test('donation history recovers from a failed read and shows the reason for rejection', async ({
  page,
}) => {
  const reason = 'O material chegou com páginas ausentes.';
  let reads = 0;
  await page.route('**/api/v1/me/donations?*', (route) => {
    reads++;
    return reads === 1
      ? route.fulfill({ status: 503, json: {} })
      : route.fulfill({
          json: {
            items: [{ ...material, status: 'REJECTED', rejectReason: reason }],
            page: 1,
            pageSize: 10,
            total: 1,
          },
        });
  });
  await page.goto('/minhas-doacoes');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByText(reason, { exact: false })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Cancelar doação' }),
  ).toHaveCount(0);
});

test('only a resolved empty history invites the first donation', async ({ page }) => {
  let release;
  const ready = new Promise(resolve => { release = resolve; });
  await page.route('**/api/v1/me/donations?*', async route => {
    await ready;
    await route.fulfill({ json: { items: [], total: 0, page: 1, pageSize: 10 } });
  });
  await page.goto('/minhas-doacoes');
  await expect(page.getByText('Carregando suas doações…')).toBeVisible();
  const empty = page.getByRole('heading', { name: 'Você ainda não fez uma doação' });
  await expect(empty).toHaveCount(0);
  release();
  await expect(empty).toBeVisible();
  await expect(page.getByRole('link', { name: 'Doar um material' })).toHaveAttribute('href', '/doar');
});

test('a lost donation response keeps the form and offers history before another submission', async ({ page }) => {
  let posts = 0;
  await page.route('**/api/v1/institutions?*', route =>
    route.fulfill({ json: { items: [institution], total: 1, page: 1, pageSize: 50 } }));
  await page.route('**/api/v1/donations', route => {
    posts++;
    return route.abort('connectionreset');
  });
  await page.goto('/doar');
  await page.getByLabel('Título do material').fill(material.title);
  await page.getByLabel('Descrição', { exact: true }).fill(material.description);
  await page.getByLabel('Categoria', { exact: true }).selectOption('BOOK');
  await page.getByLabel('Condição', { exact: true }).selectOption('GOOD');
  await page.getByLabel('Instituição', { exact: true }).selectOption(institution.id);
  await page.getByRole('button', { name: 'Cadastrar doação' }).click();
  await expect(page.getByRole('alert')).toContainText('Não foi possível confirmar');
  await expect(page.getByRole('link', { name: 'Conferir histórico em outra aba' })).toHaveAttribute('href', '/minhas-doacoes');
  await expect(page.getByText('Doação cadastrada', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Título do material')).toHaveValue(material.title);
  expect(posts).toBe(1);
});


for (const width of [320, 390, 768, 1440]) {
  test('long donation records wrap at ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const suffix = 'x'.repeat(65);
    const record = {
      ...material,
      title: 'Atlas ' + suffix,
      institution: { ...institution, name: 'Instituto ' + suffix, publicAddress: 'Alameda ' + suffix },
      status: 'REJECTED',
      rejectReason: 'Faltam páginas do capítulo ' + suffix,
    };
    await page.route('**/api/v1/me/donations?*', route =>
      route.fulfill({ json: { items: [record], total: 1, page: 1, pageSize: 10 } }));
    await page.goto('/minhas-doacoes');
    await expect(page.getByText(record.rejectReason, { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancelar doação' })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(audit.violations.map(violation => violation.id)).toEqual([]);
  });
}
