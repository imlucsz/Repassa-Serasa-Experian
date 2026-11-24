// Captures real rendered screens of the implemented app via Chromium.
// Usage: node figma-reference/tools/capture.mjs [baseURL]
// Requires the Vite dev server running (default http://127.0.0.1:5173).
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiRouter } from './dataset.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = join(ROOT, 'shots');
const BASE = process.argv[2] || 'http://127.0.0.1:5173';
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

// [filename, path, role, action?, viewport]
const shots = [
  ['V01-home-IMPLEMENTED', '/', null, 'settle'],
  ['V02-catalogo-estante-IMPLEMENTED', '/catalogo?vista=estante', null, 'shelf'],
  ['V02b-catalogo-grade-IMPLEMENTED', '/catalogo?vista=grade', null, 'settle'],
  ['V03-material-detalhe-IMPLEMENTED', null, null, 'settle'], // path set below
  ['V04-entrar-IMPLEMENTED', '/entrar', null],
  ['V05-cadastro-IMPLEMENTED', '/cadastro', null],
  ['V99-404-IMPLEMENTED', '/pagina-que-nao-existe', null],
  ['E01-doar-IMPLEMENTED', '/doar', 'STUDENT'],
  ['E03-minhas-doacoes-IMPLEMENTED', '/minhas-doacoes', 'STUDENT'],
  ['E08-perfil-IMPLEMENTED', '/perfil', 'STUDENT'],
  ['E04-reserva-confirmada-IMPLEMENTED', null, 'STUDENT', 'reserve'],
  ['I01-instituicao-painel-IMPLEMENTED', '/instituicao', 'STAFF', 'settle'],
  ['I02-recebimentos-IMPLEMENTED', '/instituicao/recebimentos', 'STAFF'],
  ['I04-estoque-IMPLEMENTED', '/instituicao/estoque', 'STAFF'],
];

const mobileShots = [
  ['V01-home-mobile-IMPLEMENTED', '/', null, 'settle'],
  ['V02-catalogo-mobile-IMPLEMENTED', '/catalogo?vista=grade', null],
  ['V03-material-detalhe-mobile-IMPLEMENTED', null, null],
  ['V04-entrar-mobile-IMPLEMENTED', '/entrar', null],
  ['E03-minhas-doacoes-mobile-IMPLEMENTED', '/minhas-doacoes', 'STUDENT'],
  ['I02-recebimentos-mobile-IMPLEMENTED', '/instituicao/recebimentos', 'STAFF'],
];

const detailPath = '/materiais/39ea38aa-78f3-4870-b586-000000000001';

// Additional implemented states (dialogs, confirmations, guards).
const extraShots = [
  ['E02-doacao-confirmada-IMPLEMENTED', '/doar', 'STUDENT', 'donate'],
  ['E04-reserva-confirmada-IMPLEMENTED', detailPath, 'STUDENT', 'reserve-full'],
  ['E07-doacao-cancelar-IMPLEMENTED', '/minhas-doacoes', 'STUDENT', 'cancelDonation'],
  ['E09-acesso-restrito-IMPLEMENTED', '/instituicao', 'STUDENT'],
  ['E10-sessao-indisponivel-IMPLEMENTED', '/perfil', 'SESSION_ERROR'],
  ['I03-recebimento-recusar-IMPLEMENTED', '/instituicao/recebimentos', 'STAFF', 'reject'],
];
if (process.argv[3] !== 'extra') extraShots.length = 0;

async function main() {
  const browser = await chromium.launch();
  const results = [];
  for (const [name, path, role, action, viewport = DESKTOP] of (process.argv[3] === 'extra' ? [] : shots)
    .concat(extraShots)
    .concat(
      process.argv[3] ? [] : mobileShots.map(([n, p, r, a]) => [n, p, r, a, MOBILE]),
    )) {
    const target = path === null ? detailPath : path;
    const context = await browser.newContext({ viewport, locale: 'pt-BR' });
    const page = await context.newPage();
    const misses = [];
    await page.route('**/api/v1/**', async (route) => {
      const handler = apiRouter(role);
      await handler(route);
      // handled inside; record non-2xx
    });
    page.on('response', (res) => {
      if (res.url().includes('/api/v1/') && res.status() >= 400)
        misses.push(res.status() + ' ' + res.url());
    });
    try {
      await page.goto(BASE + target, { waitUntil: 'networkidle', timeout: 30000 });
      if (action === 'shelf') await page.waitForTimeout(1500);
      if (action === 'reserve' || action === 'reserve-full') {
        await page
          .getByRole('button', { name: 'Reservar este material' })
          .click({ timeout: 10000 });
        await page.waitForSelector('.pickup-code', { timeout: 10000 });
      }
      if (action === 'donate') {
        await page.getByLabel('Título do material').fill('Geometria descritiva');
        await page.getByLabel('Descrição').fill('Apostila com exercícios de desenho técnico.');
        await page.getByLabel('Categoria').selectOption('Livros');
        await page.getByLabel('Condição').selectOption('Em bom estado');
        await page.getByLabel('Instituição').selectOption({ index: 1 });
        await page
          .getByRole('button', { name: /Cadastrar doação/ })
          .click();
        await page.waitForSelector('.donation-receipt', { timeout: 10000 });
      }
      if (action === 'reject') {
        await page
          .getByRole('button', { name: 'Recusar' })
          .first()
          .click({ timeout: 10000 });
        await page.waitForSelector('dialog[open], dialog.inst-dialog', { timeout: 10000 });
        await page.waitForTimeout(400);
      }
      if (action === 'cancelDonation') {
        await page
          .getByRole('button', { name: 'Cancelar doação' })
          .first()
          .click({ timeout: 10000 });
        await page.waitForTimeout(500);
      }
      if (action === 'settle') await page.waitForTimeout(700);
      const file = join(SHOTS, name + '.png');
      mkdirSync(dirname(file), { recursive: true });
      await page.screenshot({ path: file, fullPage: action === 'reserve-full' });
      results.push('OK  ' + name + (misses.length ? '  [api ' + misses.join(', ') + ']' : ''));
    } catch (error) {
      results.push('ERR ' + name + ' — ' + String(error).split('\n')[0]);
    }
    await context.close();
  }
  await browser.close();
  console.log(results.join('\n'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
