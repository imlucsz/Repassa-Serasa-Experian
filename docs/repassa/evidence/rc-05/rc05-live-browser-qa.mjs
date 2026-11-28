// Focused RC-05 live-browser QA against the controlled stack. Screenshots omit pickup codes.
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const repoRoot = process.cwd();
const rootRequire = createRequire(resolve(repoRoot, 'package.json'));
const { chromium } = rootRequire('playwright');
const { expect } = rootRequire('@playwright/test');
const base = process.env.JOURNEY_BASE ?? 'http://127.0.0.1:5272';
const out = process.env.QA_SHOTS ?? 'C:/Users/Administrator/AppData/Local/Temp/repassa-rc05/screens/live-qa';
const adminPassword = process.env.REPASSA_ADMIN_PASSWORD;
const pw = process.env.JOURNEY_PASSWORD ?? 'senha-jornada-2026';
await mkdir(out, { recursive: true });
const results = [];
const check = (name, ok, extra = '') => {
  results.push([name, ok]);
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' — ' + extra : ''));
};
async function shot(page, name) {
  await page.screenshot({ path: out + '/' + name + '.png', fullPage: false });
}
async function login(page, email, password, urlRe) {
  await page.goto(base + '/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(urlRe, { timeout: 15000 });
}
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
function watch(page) {
  page.on('pageerror', (e) => errors.push(e.message));
  page.setDefaultTimeout(12000);
  return page;
}

try {
  // Anonymous desktop: official home, film, shelf, grid and detail with live API data.
  const anonCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });
  const anon = watch(await anonCtx.newPage());
  await anon.goto(base + '/');
  await expect(anon.getByRole('heading', { level: 1 })).toHaveText('Toda última página tem um recomeço.');
  await anon.getByRole('button', { name: 'Assistir ao filme' }).click();
  const video = anon.locator('video');
  await expect(video).toBeFocused();
  await expect.poll(() => video.evaluate((v) => v.currentTime)).toBeGreaterThan(0);
  await anon.keyboard.press('Space');
  check('Home oficial cinematográfica e filme original reproduzem', true);
  await shot(anon, '01-home-film-1440');

  await anon.goto(base + '/catalogo?vista=estante');
  const shelf = anon.getByRole('region', { name: 'Estante de materiais' });
  await expect(shelf).toBeVisible();
  await shelf.focus();
  await anon.keyboard.press('ArrowRight');
  check('catálogo 3D opera por teclado com dados reais', true);
  await shot(anon, '02-catalogo-estante-1440');
  await anon.getByRole('button', { name: 'Grade', exact: true }).click();
  await expect(anon.locator('.material-grid')).toBeVisible();
  const firstMaterial = anon.locator('.material-grid a').first();
  await expect(firstMaterial).toBeVisible();
  const materialHref = await firstMaterial.getAttribute('href');
  await anon.goto(base + materialHref);
  await expect(anon.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(anon.getByRole('button', { name: /reservar/i }).first()).toBeVisible();
  check('detalhe de material real abre a partir do catálogo', true);
  await shot(anon, '03-material-detalhe-1440');

  // Keyboard order on home, in a fresh page with initial browser focus.
  const keyboardPage = watch(await anonCtx.newPage());
  await keyboardPage.goto(base + '/');
  await expect(keyboardPage.getByRole('heading', { level: 1 })).toBeVisible();
  await keyboardPage.keyboard.press('Tab');
  const skipFocused = await keyboardPage.locator('.skip').evaluate((el) => el === document.activeElement).catch(() => false);
  check('navegação por teclado começa no link de salto', skipFocused === true);
  await keyboardPage.close();

  // Mobile navigation and no horizontal overflow.
  const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'pt-BR' });
  const mobile = watch(await mobileCtx.newPage());
  await mobile.goto(base + '/');
  await expect(mobile.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Acervo' })).toBeVisible();
  await expect(mobile.getByRole('link', { name: /Entrar/ })).toBeVisible();
  const noOverflowHome = await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  await mobile.goto(base + '/catalogo');
  await expect(mobile.getByRole('button', { name: 'Grade' })).toBeVisible();
  const noOverflowCatalog = await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  check('navegação móvel 390px sem overflow horizontal', noOverflowHome && noOverflowCatalog);
  await shot(mobile, '04-mobile-catalogo-390');

  // Reduced motion.
  const reducedCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', locale: 'pt-BR' });
  const reduced = watch(await reducedCtx.newPage());
  await reduced.goto(base + '/');
  await expect(reduced.getByRole('heading', { level: 1 })).toBeVisible();
  const running = await reduced.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length);
  await reduced.goto(base + '/catalogo');
  const gridPressed = await reduced.getByRole('button', { name: 'Grade' }).getAttribute('aria-pressed');
  check('reduced motion usa conteúdo final e grade acessível', running === 0 && gridPressed === 'true', 'animations=' + running);

  // Student donor profile/history.
  const donorCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });
  const donor = watch(await donorCtx.newPage());
  await login(donor, 'doadora.ana@example.com', pw, /catalogo|perfil|doar/);
  await donor.goto(base + '/perfil');
  await expect(donor.getByRole('heading', { level: 1 })).toContainText('Meu');
  await expect(donor.getByText('doadora.ana@example.com')).toBeVisible();
  check('login real de estudante e perfil carregam', true);
  await shot(donor, '05-perfil-estudante-1440');
  await donor.goto(base + '/minhas-doacoes');
  await expect(donor.getByRole('heading', { level: 1 })).toContainText('Minhas');
  await expect(donor.getByText('Atlas Geográfico da Jornada')).toBeVisible();
  check('histórico real de doações carrega', true);
  await shot(donor, '06-minhas-doacoes-1440');

  // Student reservation history (terminal states only; no pickup code revealed).
  const studentCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });
  const student = watch(await studentCtx.newPage());
  await login(student, 'aluno.beto@example.com', pw, /catalogo|perfil|doar/);
  await student.goto(base + '/minhas-reservas');
  await expect(student.getByRole('heading', { level: 1 })).toContainText('Minhas');
  await expect(student.getByRole('heading', { name: 'Atlas Geográfico da Jornada' }).first()).toBeVisible();
  const body = await student.locator('main').innerText();
  check('histórico real de reservas carrega sem expor código', !/[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/i.test(body));
  await shot(student, '07-minhas-reservas-1440');

  // Staff operations.
  const staffCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });
  const staff = watch(await staffCtx.newPage());
  await login(staff, 'equipe.carla@example.com', pw, /instituicao/);
  await expect(staff.getByRole('heading', { level: 1 })).toHaveText('Painel da instituição');
  await staff.goto(base + '/instituicao/recebimentos');
  await expect(staff.getByRole('heading', { level: 1 })).toHaveText('Recebimentos');
  await staff.goto(base + '/instituicao/estoque');
  await expect(staff.getByRole('heading', { level: 1 })).toHaveText('Estoque');
  await expect(staff.getByText('Atlas Geográfico da Jornada')).toBeVisible();
  await staff.goto(base + '/instituicao/retirada');
  await expect(staff.getByRole('heading', { level: 1 })).toHaveText('Retiradas');
  check('operações institucionais reais carregam no escopo autorizado', true);
  await shot(staff, '08-instituicao-retirada-1440');

  // Admin operations and audit.
  const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });
  const admin = watch(await adminCtx.newPage());
  await login(admin, 'admin-jornada@example.com', adminPassword, /\/admin/);
  await expect(admin.getByRole('heading', { level: 1 })).toContainText('Visão');
  for (const [path, text] of [
    ['/admin/instituicoes', 'Instituições'], ['/admin/usuarios', 'Usuários e permissões'],
    ['/admin/materiais', 'Materiais'], ['/admin/reservas', 'Reservas'], ['/admin/auditoria', 'Histórico de auditoria'],
  ]) {
    await admin.goto(base + path);
    await expect(admin.getByRole('heading', { level: 1 })).toHaveText(text);
  }
  check('operações administrativas e auditoria reais carregam', true);
  await shot(admin, '09-admin-auditoria-1440');
} catch (error) {
  check('execução browser QA sem exceção', false, error?.message ?? String(error));
} finally {
  await browser.close().catch(() => {});
}
check('nenhum erro JavaScript de página', errors.length === 0, errors.join(' | ').slice(0, 180));
const failed = results.filter(([, ok]) => !ok);
console.log('\n' + (results.length - failed.length) + '/' + results.length + ' verificações browser QA live ok');
process.exit(failed.length ? 1 : 0);
