// RC-05 supplemental live validation on the controlled disposable stack.
// Prints no tokens, cookies, pickup codes, passwords or storage keys.
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const repoRoot = process.cwd();
const { assertControlledHarnessEnvironment } = await import(
  pathToFileURL(resolve(repoRoot, 'tests/live/harness-guard.mjs')).href
);
const api = process.env.JOURNEY_API ?? 'http://127.0.0.1:3001/api/v1';
const base = process.env.JOURNEY_BASE ?? 'http://127.0.0.1:5272';
const manifestPath = process.env.JOURNEY_STACK_MANIFEST;
const dbUrl = process.env.JOURNEY_DB_URL;
const adminEmail = process.env.REPASSA_ADMIN_EMAIL ?? 'admin-jornada@example.com';
const adminPassword = process.env.REPASSA_ADMIN_PASSWORD;
if (!dbUrl) throw new Error('JOURNEY_DB_URL required');
await assertControlledHarnessEnvironment({
  base, api, dbUrl, manifestPath, adminEmail, adminPassword, requireFrontend: true,
});

const backendRequire = createRequire(resolve(repoRoot, 'backend/package.json'));
const { PrismaClient } = backendRequire('@prisma/client');
const sharp = backendRequire('sharp');
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
const { resetUserPassword } = await import(
  pathToFileURL(resolve(repoRoot, 'backend/dist/auth/password-reset.js')).href
);

const OLD_PASSWORD = process.env.JOURNEY_PASSWORD ?? 'senha-jornada-2026';
const NEW_PASSWORD = 'rc05-senha-renovada-2026';
const DONOR = { email: 'doadora.bia@example.com', password: OLD_PASSWORD };
const BETO = { email: 'aluno.beto@example.com', password: OLD_PASSWORD };
const STAFF_A = { email: 'equipe.carla@example.com', password: OLD_PASSWORD };
const STAFF_B = { email: 'equipe.b@example.com', password: OLD_PASSWORD };
const png = await sharp({
  create: { width: 8, height: 8, channels: 3, background: { r: 30, g: 100, b: 70 } },
}).png().toBuffer();

const results = [];
function check(name, ok, extra = '') {
  results.push([name, ok]);
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' — ' + extra : ''));
}
async function call(method, path, { token, body, form, cookie } = {}) {
  const headers = { 'X-Repassa-Request': '1' };
  if (body) headers['content-type'] = 'application/json';
  if (token) headers.authorization = 'Bearer ' + token;
  if (cookie) headers.cookie = cookie;
  const res = await fetch(api + path, {
    method, headers, redirect: 'manual',
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });
  const type = res.headers.get('content-type') ?? '';
  const data = type.includes('application/json') ? await res.json().catch(() => null) : null;
  return { status: res.status, data, headers: res.headers };
}
async function login(email, password) {
  const r = await call('POST', '/auth/login', { body: { email, password } });
  const cookiePair = (r.headers.get('set-cookie') ?? '').split(';')[0] || null;
  return { ...r, accessToken: r.data?.accessToken ?? null, cookiePair };
}

try {
  const [donorLogin, betoLogin, staffALogin, staffBLogin] = await Promise.all([
    login(DONOR.email, DONOR.password), login(BETO.email, BETO.password),
    login(STAFF_A.email, STAFF_A.password), login(STAFF_B.email, STAFF_B.password),
  ]);
  check('contas sintéticas disponíveis para validação complementar',
    !!(donorLogin.accessToken && betoLogin.accessToken && staffALogin.accessToken && staffBLogin.accessToken));

  const institutions = (await call('GET', '/institutions?pageSize=50')).data;
  const institutionA = institutions?.items.find((i) => i.name === 'Escola Horizonte da Jornada');
  check('instituição A localizada no catálogo público', !!institutionA);

  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'rc05-material.png');
  const upload = await call('POST', '/uploads', { token: donorLogin.accessToken, form });
  check('upload PNG autenticado aceito', upload.status === 201 && !!upload.data?.uploadId, 'status=' + upload.status);

  const donation = await call('POST', '/donations', {
    token: donorLogin.accessToken,
    body: {
      title: 'Material Visual RC-05 ' + Date.now().toString(36),
      description: 'Material sintético para validação integrada de imagem e sessão.',
      category: 'BOOK', condition: 'GOOD', institutionId: institutionA.id, uploadId: upload.data?.uploadId,
    },
  });
  check('doação com uploadId próprio criada', donation.status === 201 && !!donation.data?.imageUrl, 'status=' + donation.status);
  const material = donation.data ?? {};
  const imageUrl = material.imageUrl ?? '';
  const key = imageUrl.split('/').pop();
  check('resposta usa URL controlada de upload', /^\/api\/v1\/uploads\//.test(imageUrl) && !!key);

  async function getImage(token) {
    const res = await fetch(api + '/uploads/' + key, {
      headers: token ? { authorization: 'Bearer ' + token } : {}, redirect: 'manual',
    });
    return { status: res.status, type: res.headers.get('content-type'), bytes: Buffer.from(await res.arrayBuffer()) };
  }
  const [anonymous, owner, unrelated, correctStaff, wrongStaff] = await Promise.all([
    getImage(), getImage(donorLogin.accessToken), getImage(betoLogin.accessToken),
    getImage(staffALogin.accessToken), getImage(staffBLogin.accessToken),
  ]);
  check('imagem pendente: anônimo recebe 404', anonymous.status === 404, 'status=' + anonymous.status);
  check('imagem pendente: doador recebe 200 com bytes PNG', owner.status === 200 && owner.type === 'image/png' && owner.bytes.length > 0, 'status=' + owner.status + ' bytes=' + owner.bytes.length);
  check('imagem pendente: estudante sem relação recebe 404', unrelated.status === 404, 'status=' + unrelated.status);
  check('imagem pendente: staff da instituição recebe 200', correctStaff.status === 200, 'status=' + correctStaff.status);
  check('imagem pendente: staff de outra instituição recebe 404', wrongStaff.status === 404, 'status=' + wrongStaff.status);

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  check('objeto persistido no armazenamento local controlado', existsSync(join(manifest.uploadDir, key)));

  const reset = await resetUserPassword(prisma, { email: DONOR.email, password: NEW_PASSWORD });
  check('reset fora de banda revogou todas as sessões', reset.sessionsRevoked >= 1 && reset.unrevokedSessions === 0, 'revogadas=' + reset.sessionsRevoked);
  const oldMe = await call('GET', '/me', { token: donorLogin.accessToken });
  check('access token anterior à redefinição é invalidado imediatamente', oldMe.status === 401, 'status=' + oldMe.status);
  const oldRefresh = await call('POST', '/auth/refresh', { cookie: donorLogin.cookiePair });
  check('refresh cookie anterior à redefinição não rotaciona', oldRefresh.status === 401, 'status=' + oldRefresh.status);
  const oldPasswordLogin = await login(DONOR.email, OLD_PASSWORD);
  check('senha antiga rejeitada após reset', oldPasswordLogin.status === 401, 'status=' + oldPasswordLogin.status);
  const freshLogin = await login(DONOR.email, NEW_PASSWORD);
  check('nova senha autentica após reset', freshLogin.status === 200 && !!freshLogin.accessToken, 'status=' + freshLogin.status);
  const freshImage = freshLogin.accessToken ? await getImage(freshLogin.accessToken) : { status: 0 };
  check('novo access token autoriza imagem privada do próprio usuário', freshImage.status === 200, 'status=' + freshImage.status);

  const audit = await prisma.auditEvent.findFirst({ where: { action: 'admin.password_reset' }, orderBy: { createdAt: 'desc' } });
  const auditText = JSON.stringify(audit?.metadata ?? {});
  check('auditoria do reset existe sem senha/hash',
    !!audit && audit.metadata?.targetUserId === reset.userId && !auditText.includes(OLD_PASSWORD) && !auditText.includes(NEW_PASSWORD) && !auditText.includes('$argon2'));

  const receive = await call('POST', `/institutions/${institutionA.id}/materials/${material.id}/receive`, { token: staffALogin.accessToken });
  check('staff autorizado recebe a doação da validação', receive.status === 200, 'status=' + receive.status);
  const publicImage = await getImage();
  check('imagem AVAILABLE pública recuperada com bytes reais', publicImage.status === 200 && publicImage.type === 'image/png' && publicImage.bytes.length > 0, 'status=' + publicImage.status + ' bytes=' + publicImage.bytes.length);
  const history = await call('GET', '/me/donations?pageSize=50', { token: freshLogin.accessToken });
  check('histórico do doador preserva material após reset e recebimento',
    history.status === 200 && history.data.items.some((d) => d.id === material.id && d.status === 'AVAILABLE'), 'status=' + history.status);

  await writeFile(join(manifest.uploadDir, '..', 'recovery-session.json'), JSON.stringify({
    email: DONOR.email, password: NEW_PASSWORD, accessToken: freshLogin.accessToken,
    cookiePair: freshLogin.cookiePair, materialId: material.id,
  }));
} finally {
  await prisma.$disconnect();
}

const failed = results.filter(([, ok]) => !ok);
console.log('\n' + (results.length - failed.length) + '/' + results.length + ' verificações complementares ok');
process.exit(failed.length ? 1 : 0);
