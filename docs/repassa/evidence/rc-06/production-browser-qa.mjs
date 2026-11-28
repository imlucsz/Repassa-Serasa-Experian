// Read-only RC-06 production browser validation. No credentials, forms or mutations.
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const rootRequire = createRequire(resolve(process.cwd(), 'package.json'));
const { chromium } = rootRequire('playwright');
const { expect } = rootRequire('@playwright/test');
const { AxeBuilder } = rootRequire('@axe-core/playwright');
const base = 'https://repassa-serasa-experian.vercel.app';
const out = process.env.RC06_SCREENSHOT_DIR ?? join(tmpdir(), 'repassa-rc06', 'screens');
await mkdir(out, { recursive: true });
const results = [];
const observations = [];
const check = (name, ok, extra = '') => {
  results.push([name, ok]);
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' — ' + extra : ''));
};
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const pageErrors = [];
const consoleErrors = [];
const failedRequests = [];
const apiMethods = new Map();
function watch(page) {
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('requestfailed', (r) => failedRequests.push(r.url() + ' :: ' + (r.failure()?.errorText ?? 'failed')));
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith('/api/v1/')) apiMethods.set(r.method() + ' ' + u.pathname, (apiMethods.get(r.method() + ' ' + u.pathname) ?? 0) + 1);
  });
  return page;
}
async function shot(page, name) { await page.screenshot({ path: out + '/' + name + '.png', fullPage: false }); }
async function axeSummary(page, label) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
  const serious = result.violations.filter((v) => ['serious','critical'].includes(v.impact));
  check('axe sem violações serious/critical em ' + label, serious.length === 0,
    'serious=' + serious.length + ' total=' + result.violations.length);
  if (result.violations.length) observations.push({ axe: label, violations: result.violations.map(({id,impact,nodes}) => ({id,impact,targets:nodes.slice(0,3).map(n=>n.target)})) });
}

try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });
  const page = watch(await ctx.newPage());
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Toda última página tem um recomeço.');
  await expect(page.getByRole('link', { name: 'Encontrar um material' })).toBeVisible();
  check('Home oficial cinematográfica pública renderiza', true);
  await axeSummary(page, 'Home desktop');

  const play = page.getByRole('button', { name: 'Assistir ao filme' });
  await play.scrollIntoViewIfNeeded();
  await play.press('Enter');
  const video = page.locator('video');
  await expect(video).toBeFocused();
  await expect.poll(() => video.evaluate((v) => v.currentTime), { timeout: 10000 }).toBeGreaterThan(0);
  const media = await video.evaluate((v) => [v.videoWidth, v.videoHeight, Math.round(v.duration), v.controls, v.playsInline, v.textTracks[0]?.cues?.length ?? 0]);
  check('filme promocional original reproduz inline com legendas', JSON.stringify(media) === JSON.stringify([1080,1920,22,true,true,7]), JSON.stringify(media));
  await page.keyboard.press('Space');
  await shot(page, '01-production-home-film-1440');

  const keyboard = watch(await ctx.newPage());
  await keyboard.goto(base + '/');
  await expect(keyboard.getByRole('heading', { level: 1 })).toBeVisible();
  await keyboard.keyboard.press('Tab');
  const skip = await keyboard.locator('.skip').evaluate((el) => el === document.activeElement).catch(() => false);
  check('ordem de teclado começa no link de salto', skip === true);
  await keyboard.close();

  await page.goto(base + '/catalogo', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('.collection-bar p')).toContainText('12 materiais');
  const shelf = page.getByRole('region', { name: 'Estante de materiais' });
  await expect(shelf).toBeVisible();
  await shelf.focus();
  await page.keyboard.press('ArrowRight');
  check('catálogo público e estante 3D carregam dados reais de produção', true);
  await shot(page, '02-production-catalogo-estante-1440');
  await axeSummary(page, 'Catálogo desktop');
  await page.getByRole('button', { name: 'Grade', exact: true }).click();
  await expect(page.locator('.material-grid')).toBeVisible();
  const first = page.locator('.material-grid a').first();
  await expect(first).toBeVisible();
  await first.click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Moby Dick');
  const img = page.locator('main img').first();
  await expect(img).toBeVisible();
  const imageState = await img.evaluate((el) => ({ complete: el.complete, width: el.naturalWidth, src: el.getAttribute('src') }));
  check('detalhe público entrega imagem autorizada pelo proxy /api/v1/uploads', imageState.complete && imageState.width > 0 && imageState.src?.startsWith('/api/v1/uploads/'), 'naturalWidth=' + imageState.width);
  await expect(page.getByText('Instituto Proa').first()).toBeVisible();
  await shot(page, '03-production-material-detalhe-1440');
  await axeSummary(page, 'Detalhe desktop');

  await page.goto(base + '/pagina-inexistente');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  check('rota inexistente renderiza erro público controlado', true);

  const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'pt-BR' });
  const mobile = watch(await mobileCtx.newPage());
  await mobile.goto(base + '/');
  await expect(mobile.getByRole('heading', { level: 1 })).toBeVisible();
  const homeOverflow = await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  await mobile.goto(base + '/catalogo');
  await expect(mobile.getByRole('button', { name: 'Grade' })).toBeVisible();
  const catalogOverflow = await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  check('layout móvel 390px sem overflow horizontal', homeOverflow && catalogOverflow);
  await shot(mobile, '04-production-mobile-catalogo-390');
  await axeSummary(mobile, 'Catálogo móvel');

  const reducedCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', locale: 'pt-BR' });
  const reduced = watch(await reducedCtx.newPage());
  await reduced.goto(base + '/');
  await expect(reduced.getByRole('heading', { level: 1 })).toBeVisible();
  const running = await reduced.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length);
  await reduced.goto(base + '/catalogo');
  const gridPressed = await reduced.getByRole('button', { name: 'Grade' }).getAttribute('aria-pressed');
  check('reduced motion mostra conteúdo final e grade acessível', running === 0 && gridPressed === 'true', 'animations=' + running);
} catch (error) {
  check('execução browser QA produção sem exceção', false, error?.message ?? String(error));
} finally {
  await browser.close().catch(() => {});
}

const unexpectedPosts = [...apiMethods.keys()].filter((k) => !k.startsWith('GET ') && k !== 'POST /api/v1/auth/refresh');
check('nenhuma mutação de aplicação foi enviada pelo navegador', unexpectedPosts.length === 0, unexpectedPosts.join(',') || 'somente GET + probe anônimo refresh');
check('nenhum erro JavaScript de página', pageErrors.length === 0, pageErrors.join(' | ').slice(0,200));
const unexpectedConsole = consoleErrors.filter((x) => x !== 'Failed to load resource: the server responded with a status of 401 ()');
check('nenhum erro de console inesperado além da sonda anônima 401', unexpectedConsole.length === 0,
  '401-console=' + (consoleErrors.length - unexpectedConsole.length) + ' inesperados=' + unexpectedConsole.length);
const hardFailures = failedRequests.filter((x) => !x.includes('net::ERR_ABORTED'));
check('nenhuma falha não cancelada de mídia/API/documento', hardFailures.length === 0,
  'canceladas=' + (failedRequests.length - hardFailures.length) + ' falhas=' + hardFailures.length);
await writeFile('C:/Users/Administrator/AppData/Local/Temp/repassa-rc06/browser-observations.json', JSON.stringify({apiMethods:Object.fromEntries(apiMethods),pageErrors,consoleErrors,failedRequests,observations}, null, 2));
const failed = results.filter(([, ok]) => !ok);
console.log('\n' + (results.length - failed.length) + '/' + results.length + ' verificações browser produção ok');
process.exit(failed.length ? 1 : 0);
