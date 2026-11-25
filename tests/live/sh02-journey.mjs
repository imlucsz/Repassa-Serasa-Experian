// SH-02 full product journey — real API + real browser, independent contexts
// per role. Optional live-API harness (not part of CI): run against a
// disposable stack — backend test/helpers/pg-daemon.mjs, `npm run
// db:migrate:deploy`, `tsx scripts/provision-admin.ts --generate`, vite with
// VITE_DATA_MODE=api. Never point this at production.
//   JOURNEY_BASE=http://127.0.0.1:4272 JOURNEY_API=http://127.0.0.1:3001/api/v1 \
//   REPASSA_ADMIN_EMAIL=admin@x REPASSA_ADMIN_PASSWORD=<one-time> \
//   node tests/live/sh02-journey.mjs
import { chromium } from 'playwright';

const base = process.env.JOURNEY_BASE ?? 'http://127.0.0.1:4272';
const api = process.env.JOURNEY_API ?? 'http://127.0.0.1:3001/api/v1';
const shots = process.env.JOURNEY_SHOTS ?? 'docs/repassa/evidence/sh-02';
const pw = process.env.JOURNEY_PASSWORD ?? 'senha-jornada-2026';
const ADMIN = {
  email: process.env.REPASSA_ADMIN_EMAIL ?? 'admin-jornada@example.com',
  password: process.env.REPASSA_ADMIN_PASSWORD,
};
if (!ADMIN.password) {
  console.error('REPASSA_ADMIN_PASSWORD required (output of provision-admin --generate)');
  process.exit(2);
}
const DOADORA = { name: 'Doadora Ana', email: 'doadora.ana@example.com', password: pw };
const EQUIPE = { name: 'Equipe Carla', email: 'equipe.carla@example.com', password: pw };
const RESERVISTA = { name: 'Aluno Beto', email: 'aluno.beto@example.com', password: pw };
const INST = {
  name: 'Escola Horizonte da Jornada',
  address: 'Rua da Integração, 77 — Centro (fictício)',
  instructions: 'Secretaria, seg–sex 8h–16h. Apresente o código.',
};
const MAT1 = 'Atlas Geográfico da Jornada';
const MAT2 = 'Caderno de Exercícios da Jornada';
let PNG;

const results = [];
function check(name, ok, extra = '') {
  results.push([name, ok]);
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' — ' + extra : ''));
}
async function apiLogin(email, password) {
  const res = await fetch(api + '/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Repassa-Request': '1' },
    body: JSON.stringify({ email, password }),
  });
  return res.ok ? (await res.json()).accessToken : null;
}
async function apiGet(path, token) {
  const res = await fetch(api + path, {
    headers: { authorization: 'Bearer ' + token },
  });
  return res.json();
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const contexts = {};
async function ctxOf(key) {
  if (!contexts[key]) {
    contexts[key] = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await contexts[key].newPage();
    page.setDefaultTimeout(15000);
    return page;
  }
  return contexts[key].pages()[0];
}
async function register(page, user) {
  await page.goto(base + '/cadastro');
  await page.locator('input[autocomplete="name"]').fill(user.name);
  await page.locator('input[type="email"]').fill(user.email);
  for (const field of await page.locator('input[autocomplete="new-password"]').all())
    await field.fill(user.password);
  await page.getByRole('checkbox').check();
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/catalogo|perfil|doar/, { timeout: 15000 });
}
async function login(page, user, urlRe) {
  await page.goto(base + '/entrar');
  await page.getByLabel('E-mail').fill(user.email);
  await page.getByLabel('Senha', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(urlRe, { timeout: 15000 });
}

// Resume-aware: each step checks real API state first and skips UI work that
// is already done, so a rerun continues where a previous run stopped.
async function ensureAccount(key, user) {
  const page = await ctxOf(key);
  const token = await apiLogin(user.email, user.password);
  if (token) {
    await login(page, user, /catalogo|perfil|admin|instituicao/);
    return 'login';
  }
  await register(page, user);
  return 'register';
}

// 1. Accounts (STUDENT each on first run)
const pageA = await ctxOf('doadora');
const accA = await ensureAccount('doadora', DOADORA);
PNG = await pageA.screenshot(); // real PNG bytes for the upload
check('cadastro público da doadora', /catalogo|perfil/.test(pageA.url()), accA);
const pageB = await ctxOf('reservista');
await ensureAccount('reservista', RESERVISTA);
const pageS = await ctxOf('equipe-staff');
await ensureAccount('equipe-staff', EQUIPE);

// 2. Institutional registration — submit only while no record exists
const tokenAdm = await apiLogin(ADMIN.email, ADMIN.password);
const instFind = async (status) =>
  (await apiGet('/admin/institutions?status=' + status + '&pageSize=50', tokenAdm))
    .items.find((i) => i.name === INST.name);
let instRec = (await instFind('APPROVED')) ?? (await instFind('PENDING'));
if (!instRec) {
  await pageA.goto(base + '/instituicoes/nova');
  await pageA.getByLabel('Nome da instituição').fill(INST.name);
  await pageA.getByLabel('Endereço público').fill(INST.address);
  await pageA.getByLabel('Instruções de retirada').fill(INST.instructions);
  await pageA.getByRole('button', { name: 'Enviar para análise' }).click();
  await pageA.waitForSelector('text=Cadastro enviado para análise');
  check('cadastro institucional enviado', true);
  const pub0 = await (await fetch(api + '/institutions')).json();
  check('pendente fora do catálogo público', pub0.total === 0, 'total=' + pub0.total);
  await pageA.screenshot({ path: shots + '/01-cadastro-instituicao.png' });
  instRec = await instFind('PENDING');
}

// 3. Admin approves (if still pending) + assigns Carla (if still STUDENT)
const pageAdm = await ctxOf('admin');
await login(pageAdm, ADMIN, /\/admin/);
if (instRec.status === 'PENDING') {
  await pageAdm.goto(base + '/admin/instituicoes?status=PENDING');
  await pageAdm.getByRole('row', { name: new RegExp('Horizonte da Jornada') })
    .getByRole('button', { name: 'Aprovar' }).click();
  await pageAdm.getByRole('button', { name: 'Aprovar instituição' }).click();
  await pageAdm.waitForTimeout(800);
}
instRec = await instFind('APPROVED');
check('aprovação persistida', !!instRec && instRec.isActive === true);
const instId = instRec.id;
const carlaApi = await apiGet('/admin/users?q=carla', tokenAdm);
if (carlaApi.items[0].role !== 'STAFF') {
  await pageAdm.goto(base + '/admin/instituicoes/' + instId);
  await pageAdm.getByLabel('Buscar por nome ou e-mail').fill('carla');
  await pageAdm.getByRole('button', { name: 'Buscar' }).click();
  await pageAdm.getByRole('button', { name: 'Vincular', exact: true }).click();
  await pageAdm.waitForTimeout(800);
}
const carlaNow = await apiGet('/admin/users?q=carla', tokenAdm);
check('atribuição promoveu Carla a STAFF', carlaNow.items[0].role === 'STAFF');
await pageAdm.screenshot({ path: shots + '/02-admin-membros.png' });

// 4. Doadora donates two materials (one with photo) — skip what already exists
let donToken = await apiLogin(DOADORA.email, DOADORA.password);
const donTitles = async () =>
  (await apiGet('/me/donations?pageSize=20', donToken)).items.map((d) => d.title);
for (const [title, withPhoto] of [[MAT1, true], [MAT2, false]]) {
  if ((await donTitles()).includes(title)) {
    check('doação criada: ' + title, true, 'já existia');
    continue;
  }
  await pageA.goto(base + '/doar');
  await pageA.getByLabel('Título do material').fill(title);
  await pageA.getByLabel('Descrição', { exact: true }).fill('Material doado na jornada de integração.');
  await pageA.getByLabel('Categoria', { exact: true }).selectOption('BOOK');
  await pageA.getByLabel('Condição', { exact: true }).selectOption('GOOD');
  const instSelect = pageA.getByLabel('Instituição', { exact: true });
  const instOption = instSelect.locator('option', { hasText: INST.name }).first();
  await instOption.waitFor({ state: 'attached' });
  await instSelect.selectOption(await instOption.getAttribute('value'));
  if (withPhoto)
    await pageA.getByLabel('Foto do material (opcional)').setInputFiles({
      name: 'capa.png', mimeType: 'image/png', buffer: PNG,
    });
  await pageA.getByRole('button', { name: 'Cadastrar doação' }).click();
  await pageA.waitForTimeout(1500);
  donToken = await apiLogin(DOADORA.email, DOADORA.password);
  check('doação criada: ' + title, (await donTitles()).includes(title));
}
const myDons = await apiGet('/me/donations?pageSize=20', donToken);
check('duas doações registradas', myDons.total === 2, 'total=' + myDons.total);
const pubBefore = await (await fetch(api + '/materials?pageSize=50')).json();
check(
  'doação pendente invisível no catálogo público',
  pubBefore.items.every((m) => m.status === 'AVAILABLE'),
  'total=' + pubBefore.total,
);
await pageA.screenshot({ path: shots + '/03-doacoes.png' });

// 5. Carla (STAFF) confirms physical receipt — fresh context fetches the
// promoted role on a real login; skip receipts already confirmed
const pendingTitles = (await apiGet('/me/donations?pageSize=20', donToken)).items
  .filter((d) => d.status === 'PENDING_RECEIPT')
  .map((d) => d.title);
if (pendingTitles.length) {
  await pageS.goto(base + '/instituicao/recebimentos');
  for (const title of pendingTitles) {
    const item = pageS.getByRole('listitem').filter({ hasText: title });
    await item.getByRole('button', { name: 'Receber' }).click();
    const dialog = pageS.getByRole('dialog');
    await dialog.getByRole('checkbox').check();
    await dialog.getByRole('button', { name: 'Confirmar recebimento' }).click();
    await pageS.waitForTimeout(800);
  }
  await pageS.screenshot({ path: shots + '/04-recebimentos.png' });
}
const pubMats = await (await fetch(api + '/materials?pageSize=50')).json();
check('catálogo público com 2 materiais AVAILABLE', pubMats.total === 2, 'total=' + pubMats.total);

// 6. Reservista finds material in catalog, reserves, reveals code
await pageB.goto(base + '/catalogo?vista=grade');
await pageB.getByRole('link', { name: new RegExp(MAT1) }).first().click();
await pageB.getByRole('button', { name: /Reservar/ }).click();
await pageB.waitForTimeout(1000);
await pageB.goto(base + '/minhas-reservas');
await pageB.getByRole('button', { name: 'Mostrar código' }).click();
await pageB.waitForTimeout(800);
const bodyText = await pageB.locator('main').innerText();
const code = bodyText.match(/\b[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}\b/i)?.[0]
  ?? bodyText.match(/\b\d{4}-\d{4}-\d{4}\b/)?.[0];
check('código de retirada revelado', !!code, code ?? 'não encontrado');
await pageB.screenshot({ path: shots + '/05-reserva-codigo.png' });
// second material also reserved (for cancel + duplicate checks)
await pageB.goto(base + '/catalogo?vista=grade');
await pageB.getByRole('link', { name: new RegExp(MAT2) }).first().click();
await pageB.getByRole('button', { name: /Reservar/ }).click();
await pageB.waitForTimeout(1000);

// 7. Carla confirms pickup with code
await pageS.goto(base + '/instituicao/retirada');
await pageS.getByLabel('Código de retirada').fill(code);
await pageS.getByRole('checkbox').check();
await pageS.getByRole('button', { name: 'Confirmar retirada' }).click();
await pageS.waitForSelector('text=/Retirada confirmada/i');
check('retirada confirmada pela equipe', true);
await pageS.screenshot({ path: shots + '/06-retirada-confirmada.png' });
// duplicate pickup must be refused with the same opaque message
await pageS.getByRole('button', { name: 'Registrar outra retirada' }).click();
await pageS.getByLabel('Código de retirada').fill(code);
await pageS.getByRole('checkbox').check();
await pageS.getByRole('button', { name: 'Confirmar retirada' }).click();
await pageS.waitForSelector('text=/inválido|vencido|utilizado/i');
check('código reutilizado recusado (uso único)', true);

// 8. Reservista cancels the second reservation (inline confirm inside the row)
await pageB.goto(base + '/minhas-reservas');
const row2 = pageB.getByRole('article').filter({ hasText: MAT2 });
await row2.waitFor();
await row2.getByRole('button', { name: 'Cancelar reserva' }).click();
await row2.getByRole('button', { name: 'Confirmar cancelamento' }).click();
await pageB.waitForTimeout(800);
const reservasB = await apiGet('/me/reservations?pageSize=20', await apiLogin(RESERVISTA.email, RESERVISTA.password));
check(
  'histórico: 1 COMPLETED + 1 CANCELED',
  reservasB.items.filter((r) => r.status === 'COMPLETED').length === 1 &&
    reservasB.items.filter((r) => r.status === 'CANCELED').length === 1,
  reservasB.items.map((r) => r.status).join(','),
);
check(
  'material cancelado volta ao catálogo',
  (await (await fetch(api + '/materials?pageSize=50')).json()).items.some(
    (m) => m.title === MAT2 && m.status === 'AVAILABLE',
  ),
);

// 9. Admin metrics + audit
await pageAdm.goto(base + '/admin');
await pageAdm.waitForSelector('.admin-metrics');
const metrics = await pageAdm.locator('.admin-metrics').innerText();
check('métrica retiradas concluídas = 1', /Retiradas concluídas\s*1/.test(metrics.replace(/\n/g, ' ')), metrics.replace(/\n/g, ' | '));
await pageAdm.goto(base + '/admin/auditoria');
await pageAdm.waitForSelector('.admin-table');
const audit = await apiGet('/admin/audit-events?pageSize=50', tokenAdm);
const actions = audit.items.map((e) => e.action);
check(
  'auditoria cobre ciclo admin',
  actions.includes('admin.institution_approve') && actions.includes('admin.membership_assign'),
  actions.join(','),
);
await pageAdm.screenshot({ path: shots + '/07-admin-dashboard-final.png' });
await pageAdm.screenshot({ path: shots + '/08-admin-auditoria.png' });

await browser.close();
const failed = results.filter(([, ok]) => !ok);
console.log('\n' + (results.length - failed.length) + '/' + results.length + ' verificações da jornada ok');
process.exit(failed.length ? 1 : 0);
