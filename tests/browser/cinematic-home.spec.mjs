import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const preview = '/preview/home-cinematica';

async function finishShortAnimations(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    const animations = document.getAnimations().filter((animation) => {
      const timing = animation.effect?.getComputedTiming();
      return timing && Number.isFinite(timing.endTime) && timing.endTime <= 3000;
    });
    await Promise.allSettled(animations.map((animation) => animation.finished));
  });
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`hero is contained, indexed as preview and has no horizontal overflow at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto(preview);
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toHaveText('Toda última página tem um recomeço.');
    await expect(page.getByRole('heading', { level: 2 }).last()).toContainText('Ele continua quando alguém repassa.');
    const cta = page.getByRole('link', { name: 'Encontrar um material' });
    await expect(cta).toBeVisible();
    const box = await cta.boundingBox();
    expect(box).not.toBeNull();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator('head meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex',
    );
  });

  test(`axe has no serious or critical violations at ${viewport.width}px`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(viewport);
    await page.goto(preview);
    await finishShortAnimations(page);
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(
      result.violations
        .filter((violation) => ['serious', 'critical'].includes(violation.impact))
        .map(({ id, impact, nodes }) => ({
          id,
          impact,
          targets: nodes.map((node) => node.target),
        })),
    ).toEqual([]);
  });
}

test('production home remains unchanged after leaving the preview', async ({
  page,
}) => {
  await page.goto(preview);
  await page.getByRole('link', { name: 'Encontrar um material' }).click();
  await page.getByRole('link', { name: 'RePassa, início' }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    /Conhecimento\s*merece circular\./,
  );
  await expect(page.locator('head meta[name="robots"]')).toHaveCount(0);
});

test('scrolling chapters stamps the card forwards and backwards', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(preview);
  const card = page.locator('.cine-card');
  const chapters = page.locator('.cine-chapters li');
  await chapters.nth(3).evaluate((element) => {
    element.scrollIntoView({ block: 'center' });
  });
  await expect(card).toHaveAttribute('data-stamped', '4');
  await chapters.nth(0).evaluate((element) => {
    element.scrollIntoView({ block: 'center' });
  });
  await expect(card).toHaveAttribute('data-stamped', '1');
  await page.locator('#repassar').evaluate((element) => {
    element.scrollIntoView({ block: 'center' });
  });
  await expect(card).toHaveAttribute('data-stamped', '4');
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(card).toHaveAttribute('data-stamped', '0');
});

test('keyboard reaches the skip link first and then the primary action', async ({
  page,
}) => {
  await page.goto(preview);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip')).toBeFocused();
  const cta = page.getByRole('link', { name: 'Encontrar um material' });
  for (let index = 0; index < 12; index += 1) {
    if (await cta.evaluate((element) => element === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  await expect(cta).toBeFocused();
});

test('reduced motion renders final content without running animations', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(preview);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.getAnimations().filter((animation) => animation.playState === 'running')
          .length,
    ),
  ).toBe(0);
  for (const selector of ['#cine-title', '.cine-lead', '.cine-button-dark']) {
    expect(
      await page.locator(selector).evaluate((element) => getComputedStyle(element).opacity),
    ).toBe('1');
  }
});

test('PERF-01 uses zero idle requestAnimationFrame callbacks', async ({ page }) => {
  await page.addInitScript(() => {
    window.__cineRafCount = 0;
    const original = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => {
      window.__cineRafCount += 1;
      return original(callback);
    };
  });
  await page.goto(preview);
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    window.__cineRafCount = 0;
  });
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => window.__cineRafCount)).toBe(0);
});

for (const width of [1440, 390]) {
  test(`film waits for activation and plays inline with Portuguese captions at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const mediaRequests = [];
    page.on('request', request => {
      if (request.resourceType() === 'media') mediaRequests.push(request.url());
    });
    await page.goto(preview);
    const play = page.getByRole('button', { name: 'Assistir ao filme' });
    await play.scrollIntoViewIfNeeded();
    expect(mediaRequests).toEqual([]);
    await play.focus();
    await page.keyboard.press('Enter');
    const video = page.locator('video');
    await expect(video).toBeFocused();
    await expect.poll(() => video.evaluate(el => el.currentTime)).toBeGreaterThan(0);
    await expect.poll(() => video.evaluate(el => el.textTracks[0]?.cues?.length)).toBe(7);
    expect(await video.evaluate(el => [el.videoWidth, el.videoHeight, el.duration, el.controls, el.playsInline]))
      .toEqual([1080, 1920, 22, true, true]);
    await page.keyboard.press('Space');
    await expect.poll(() => video.evaluate(el => el.paused)).toBe(true);
  });
}

test('unavailable film offers the approved alternative', async ({ page }) => {
  await page.route(/\.mp4(?:\?|$)/, route => route.request().resourceType() === 'media' ? route.abort() : route.continue());
  await page.goto(preview);
  await page.getByRole('button', { name: 'Assistir ao filme' }).click();
  await expect(page.getByRole('alert').getByRole('link')).toHaveAttribute('href', 'https://www.youtube.com/shorts/J7nbqsq0bmU');
});

test('retry returns keyboard control to the film after a failed request', async ({ page }) => {
  const media = /\.mp4(?:\?|$)/;
  await page.route(media, route => route.request().resourceType() === 'media' ? route.abort() : route.continue());
  await page.goto(preview);
  await page.getByRole('button', { name: 'Assistir ao filme' }).press('Enter');
  const retry = page.getByRole('button', { name: 'Tentar novamente' });
  await expect(retry).toBeFocused();
  await page.unroute(media);
  await retry.press('Enter');
  await expect(page.locator('video')).toBeFocused();
  await expect.poll(() => page.locator('video').evaluate(video => video.currentTime)).toBeGreaterThan(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('leaving the preview clears noindex and gives the missing page its own title', async ({ page }) => {
  await page.goto(preview);
  await expect(page).toHaveTitle(/prévia/);
  await page.evaluate(() => {
    history.pushState({}, '', '/pagina-ausente');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.locator('.cine-page')).toHaveCount(0);
  await expect(page).toHaveTitle('Página indisponível · RePassa');
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
});
