import { expect, test } from '@playwright/test';
import { north, south, staffSession } from './staff-fixtures.mjs';

// Synthetic receipt and pickup inputs. No issued code is recorded in fixtures.
const syntheticCode = 'abcd-2345-6789';
const receipt = {
  reservationId: '07fee3e9-35a3-42c7-b263-42976afa9eda',
  materialId: '3628026f-1052-412e-b75e-6aa5387662db',
  status: 'COMPLETED',
  completedAt: '2026-11-22T15:45:00Z',
};

test('o painel lê o resumo autorizado e a retirada exige o código e a entrega presencial', async ({
  page,
}) => {
  let posts = 0;
  let dashboardReads = 0;
  let release;
  const gate = new Promise((done) => {
    release = done;
  });
  await staffSession(page, async (route, path) => {
    if (path === '/institutions/' + south.id + '/dashboard') {
      dashboardReads++;
      return route.fulfill({
        json: { pendingReceipt: 8, available: 7, reserved: 6, delivered: 5 },
      });
    }
    expect(path).toBe('/institutions/' + south.id + '/pickups/confirm');
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataJSON()).toEqual({ code: syntheticCode });
    posts++;
    await gate;
    return route.fulfill({ json: receipt });
  });
  await page.goto('/instituicao?instituicao=' + south.id);
  await expect(
    page.locator('dl').getByText('6', { exact: true }),
  ).toBeVisible();
  expect(dashboardReads).toBe(1);
  await page.getByRole('link', { name: 'Registrar retirada' }).click();
  await expect(page.getByLabel('Instituição', { exact: true })).toHaveValue(
    south.id,
  );
  const code = page.getByRole('textbox', { name: 'Código de retirada' });
  const send = page.getByRole('button', { name: 'Confirmar retirada' });
  await code.fill(syntheticCode);
  await send.click();
  expect(posts).toBe(0);
  await page.getByRole('checkbox').check();
  await code.fill('incompleto');
  await send.click();
  await expect(code).toBeFocused();
  await expect(code).toHaveAttribute('aria-invalid', 'true');
  expect(posts).toBe(0);
  await code.fill(syntheticCode);
  await send.click();
  await expect(
    page.getByRole('button', { name: 'Confirmando…' }),
  ).toBeDisabled();
  await code.evaluate((field) => field.form.requestSubmit());
  release();
  await expect(
    page.getByRole('heading', { name: 'Retirada confirmada' }),
  ).toBeFocused();
  await expect(page.getByRole('status')).toContainText('12:45');
  await expect(page.getByText(syntheticCode)).toHaveCount(0);
  expect(posts).toBe(1);
  await page.getByRole('button', { name: 'Registrar outra retirada' }).click();
  await expect(code).toBeFocused();
  await expect(code).toHaveValue('');
  await expect(page.getByRole('checkbox')).not.toBeChecked();
});

test('código recusado usa a mesma mensagem para inválido ou vencido e a troca de unidade limpa o formulário', async ({
  page,
}) => {
  let posts = 0;
  await staffSession(page, async (route, path) => {
    expect(path).toBe('/institutions/' + north.id + '/pickups/confirm');
    posts++;
    return route.fulfill({
      status: 404,
      json: { message: 'Internal synthetic detail' },
    });
  });
  await page.goto('/instituicao/retiradas?instituicao=sem-vinculo');
  await expect(page).toHaveURL(
    /\/instituicao\/retirada\?instituicao=sem-vinculo$/,
  );
  await expect(page.getByRole('alert')).toContainText('Você não tem acesso');
  await expect(page.getByLabel('Código de retirada')).toHaveCount(0);
  await page.getByLabel('Instituição', { exact: true }).selectOption(north.id);
  await page.getByLabel('Código de retirada').fill(syntheticCode);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Confirmar retirada' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Código inválido, vencido ou já utilizado',
  );
  await expect(page.getByText('Internal synthetic detail')).toHaveCount(0);
  await page.getByLabel('Instituição', { exact: true }).selectOption(south.id);
  await expect(page.getByLabel('Código de retirada')).toHaveValue('');
  await expect(page.getByRole('checkbox')).not.toBeChecked();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(posts).toBe(1);
});

test('resposta perdida interrompe o envio e oferece conferência no estoque da unidade', async ({
  page,
}) => {
  let posts = 0;
  await staffSession(page, async (route, path) => {
    expect(path).toBe('/institutions/' + south.id + '/pickups/confirm');
    posts++;
    return route.abort('failed');
  });
  await page.goto('/instituicao/retirada?instituicao=' + south.id);
  await page.getByLabel('Código de retirada').fill(syntheticCode);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Confirmar retirada' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Confira a situação do material no estoque',
  );
  await expect(
    page.getByRole('link', { name: 'Consultar estoque' }),
  ).toHaveAttribute('href', '/instituicao/estoque?instituicao=' + south.id);
  await expect(
    page.getByRole('button', { name: 'Confirmar retirada' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Retirada confirmada' }),
  ).toHaveCount(0);
  expect(posts).toBe(1);
});

test('um estudante não pode consultar nem confirmar retiradas institucionais', async ({
  page,
}) => {
  await page.route('**/api/v1/**', async (route) => {
    expect(new URL(route.request().url()).pathname).toBe(
      '/api/v1/auth/refresh',
    );
    return route.fulfill({
      json: {
        user: {
          id: receipt.materialId,
          displayName: 'Estudante de teste',
          role: 'STUDENT',
          email: 'estudante@example.invalid',
        },
        accessToken: 'synthetic-student',
        expiresIn: 900,
      },
    });
  });
  await page.goto('/instituicao/retirada');
  await expect(
    page.getByRole('heading', { name: 'Acesso restrito' }),
  ).toBeVisible();
  await expect(page.getByLabel('Código de retirada')).toHaveCount(0);
});
