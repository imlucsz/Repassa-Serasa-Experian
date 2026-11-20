import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const detail = '/materiais/39ea38aa-78f3-4870-b586-000000000001';
const routes = ['/', '/entrar', '/cadastro', '/catalogo', detail];

for (const width of [390, 768, 1440]) {
  test('accessible public routes at ' + width + 'px', async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const errors = [];
    const apiCalls = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/'))
        apiCalls.push(request.method());
    });
    for (const route of routes) {
      await test.step(route, async () => {
        await page.goto(route);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(async () => {
          const transitions = document.getAnimations().filter((animation) => {
            const timing = animation.effect?.getComputedTiming();
            return (
              timing &&
              Number.isFinite(timing.endTime) &&
              timing.endTime <= 3000
            );
          });
          await Promise.allSettled(
            transitions.map((animation) => animation.finished),
          );
        });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        const result = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        expect(
          result.violations.map(({ id, nodes }) => ({
            id,
            targets: nodes.map((n) => n.target),
          })),
        ).toEqual([]);
        if (route === '/entrar' || route === '/cadastro') {
          await expect(page.locator('button[type="submit"]')).toBeDisabled();
        }
      });
    }
    expect(apiCalls).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('browse shelf by keyboard, open detail, return and filter', async ({
  page,
}) => {
  await page.goto('/catalogo');
  const shelf = page.getByRole('region', { name: 'Estante de materiais' });
  await shelf.focus();
  await page.keyboard.press('ArrowRight');
  const detailLink = shelf.getByRole('link', {
    name: /Ver material: Atlas celeste/i,
  });
  await expect(detailLink).toBeVisible();
  await detailLink.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Atlas celeste',
  );
  await page.getByRole('link', { name: 'Voltar ao acervo' }).click();
  await expect(detailLink).toBeVisible();
  await page.getByRole('button', { name: 'Grade', exact: true }).click();
  await page.getByRole('button', { name: 'Livros', exact: true }).click();
  await page.getByRole('searchbox').fill('sem-resultado');
  await page.getByRole('button', { name: 'Filtrar', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Nenhum material encontrado' }),
  ).toBeVisible();
  await expect(page).toHaveURL(/category=BOOK/);
  await page.getByRole('button', { name: 'Limpar filtros' }).first().click();
  await expect(
    page.getByRole('link', { name: /Botânica ilustrada/ }),
  ).toBeVisible();
});

test('reduced motion opens the grid and retains the explicit shelf controls', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/catalogo');
  await expect(page.getByRole('button', { name: 'Grade' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Estante', exact: true }).click();
  await page.getByRole('button', { name: 'Próximo material' }).click();
  await expect(
    page.getByRole('link', { name: /Ver material: Atlas celeste/ }),
  ).toBeVisible();
});

test('operações privadas explicam os limites da demonstração sem chamar a API', async ({
  page,
}) => {
  const requests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/v1/'))
      requests.push(request.method());
  });
  for (const path of [
    '/doar',
    '/minhas-doacoes',
    '/perfil',
    '/instituicao',
    '/instituicao/recebimentos',
    '/instituicao/estoque',
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole('heading', { name: 'Área de conta' }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Explorar o acervo' }),
    ).toBeVisible();
  }
  expect(requests).toEqual([]);
});
