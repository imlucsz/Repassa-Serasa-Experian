import { test, expect } from '@playwright/test';

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
