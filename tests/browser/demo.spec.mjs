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
    '/minhas-reservas',
    '/perfil',
    '/instituicao',
    '/instituicao/recebimentos',
    '/instituicao/estoque',
    '/instituicao/retirada',
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

test.describe('mobile shelf gestures', () => {
  test.use({
    viewport: { width: 440, height: 956 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });

  test('drag across the loop seam, then tap the selected book to open it', async ({
    page,
  }) => {
    await page.goto('/catalogo?vista=estante');
    const shelf = page.getByRole('region', { name: 'Estante de materiais' });
    const stage = shelf.locator('.book-stage');
    await stage.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    await expect(
      shelf.getByRole('heading', { name: 'Botânica ilustrada' }),
    ).toBeVisible();
    const bounds = await stage.boundingBox();
    const x = bounds.x + bounds.width / 2;
    const y = bounds.y + bounds.height / 2;
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y }],
    });
    for (const step of [12, 24, 36, 48]) {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: x + step, y }],
      });
    }
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await expect(page).toHaveURL(/\/catalogo/);
    await expect(
      shelf.getByRole('heading', { name: 'Instrumentos de desenho' }),
    ).toBeVisible();

    const cover = stage.locator('.book-face[style*="material-cover"]');
    await expect(cover.getByText('Instrumentos de desenho', { exact: true })).toBeVisible();
    await cover.tap();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Instrumentos de desenho',
    );
    await page.getByRole('link', { name: 'Voltar ao acervo' }).tap();
    await expect(
      shelf.getByRole('heading', { name: 'Instrumentos de desenho' }),
    ).toBeVisible();
  });

  test('tap on a non-active book selects it without navigating', async ({
    page,
  }) => {
    await page.goto('/catalogo?vista=estante');
    const shelf = page.getByRole('region', { name: 'Estante de materiais' });
    await shelf
      .locator('.book-stage')
      .evaluate((element) => element.scrollIntoView({ block: 'center' }));
    await expect(
      shelf.getByRole('heading', { name: 'Botânica ilustrada' }),
    ).toBeVisible();
    // Find a point that hit-tests inside a non-active book's spine.
    const target = await page.evaluate(() => {
      const active = document.querySelector(
        '.book-face[style*="material-cover"]',
      ).parentElement;
      for (const book of document.querySelectorAll('.shelf-book')) {
        if (book === active) continue;
        const rect = book
          .querySelector('.book-spine')
          .getBoundingClientRect();
        for (const fraction of [0.5, 0.2, 0.8, 0.35, 0.65]) {
          const x = rect.x + rect.width * fraction;
          const y = rect.y + rect.height / 2;
          const hit = document.elementFromPoint(x, y);
          if (hit && book.contains(hit))
            return {
              x,
              y,
              title: book.querySelector('.book-spine b').textContent,
            };
        }
      }
      return null;
    });
    expect(target).not.toBeNull();
    await page.touchscreen.tap(target.x, target.y);
    await expect(page).toHaveURL(/\/catalogo/);
    await expect(shelf.getByRole('heading', { name: target.title })).toBeVisible();
  });
});

test('reduced motion wraps both ways with one named cover', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/catalogo?vista=estante');
  const shelf = page.getByRole('region', { name: 'Estante de materiais' });
  const assertSelection = async (title) => {
    await expect(
      shelf.getByRole('link', { name: 'Ver material: ' + title }),
    ).toBeVisible();
    await expect.poll(() =>
      shelf.locator('.book-face').evaluateAll((faces) =>
        faces
          .filter((face) => getComputedStyle(face).viewTransitionName === 'material-cover')
          .map((face) => face.querySelector('.jacket-title').textContent),
      ),
    ).toEqual([title]);
  };
  await shelf.focus();
  await page.keyboard.press('ArrowLeft');
  await assertSelection('Instrumentos de desenho');
  await page.keyboard.press('ArrowRight');
  await assertSelection('Botânica ilustrada');
});


test('horizontal wheel and mouse drag navigate the 3D shelf', async ({ page }) => {
  await page.goto('/catalogo?vista=estante');
  const shelf = page.getByRole('region', { name: 'Estante de materiais' });
  const stage = shelf.locator('.book-stage');
  await stage.hover();
  await page.mouse.wheel(120, 0);
  await expect(shelf.getByRole('heading', { name: 'Atlas celeste' })).toBeVisible();
  await page.reload();
  await expect(
    shelf.getByRole('heading', { name: 'Botânica ilustrada' }),
  ).toBeVisible();
  await stage.hover();
  const bounds = await stage.boundingBox();
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  const session = await page.context().newCDPSession(page);
  await session.send('Input.dispatchMouseEvent', {
    type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1,
  });
  for (const step of [12, 24, 36, 48, 60]) {
    await session.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved', x: x - step, y, buttons: 1,
    });
  }
  await session.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased', x: x - 60, y, button: 'left', clickCount: 1,
  });
  await expect(shelf.getByRole('heading', { name: 'Atlas celeste' })).toBeVisible();
});

test('clicking the active cover navigates exactly once', async ({ page }) => {
  await page.goto('/catalogo?vista=estante');
  const shelf = page.getByRole('region', { name: 'Estante de materiais' });
  const cover = shelf.locator('.book-face[style*="material-cover"]');
  await expect(
    cover.getByText('Botânica ilustrada', { exact: true }),
  ).toBeVisible();
  await cover.click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Botânica ilustrada',
  );
  // A duplicated activation would push the detail twice and strand the
  // first Back on the same URL.
  await page.goBack();
  await expect(page).toHaveURL(/\/catalogo/);
  await expect(
    shelf.getByRole('heading', { name: 'Botânica ilustrada' }),
  ).toBeVisible();
});

test('mobile record shows identity, pickup and reservation together', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(detail);
  await page.locator('.detail-cover').waitFor();
  await page.evaluate(() => document.fonts.ready);
  for (const item of [
    page.getByRole('heading', { name: 'Botânica ilustrada' }),
    page.getByText('Exemplar demonstrativo'),
    page.getByRole('heading', { name: 'Instituto Folha Nova' }),
    page.getByRole('button', { name: 'Reserva indisponível' }),
  ]) await expect(item).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: 'Reserva indisponível' })).toBeDisabled();
});
