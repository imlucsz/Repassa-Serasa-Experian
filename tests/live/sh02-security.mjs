// SH-02 security & integration checks — real API on disposable Postgres.
// Phase 1 (default): RBAC, tenant isolation, concurrency, expiry, rate limits.
// Phase 2 (--recovery): run after restarting the backend — session survival.
// Optional live-API harness (not part of CI); never point at production.
//   JOURNEY_API=http://127.0.0.1:3001/api/v1 \
//   JOURNEY_DB_URL=postgresql://postgres:postgres@127.0.0.1:55434/repassa_test \
//   REPASSA_ADMIN_EMAIL=admin@x REPASSA_ADMIN_PASSWORD=<one-time> \
//   node tests/live/sh02-security.mjs [--recovery]
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const api = process.env.JOURNEY_API ?? 'http://127.0.0.1:3001/api/v1';
const DB_URL = process.env.JOURNEY_DB_URL;
if (!DB_URL) {
  console.error('JOURNEY_DB_URL required (disposable Postgres used by the backend)');
  process.exit(2);
}
const pw = process.env.JOURNEY_PASSWORD ?? 'senha-jornada-2026';
const ADMIN = {
  email: process.env.REPASSA_ADMIN_EMAIL ?? 'admin-jornada@example.com',
  password: process.env.REPASSA_ADMIN_PASSWORD,
};
if (!ADMIN.password) {
  console.error('REPASSA_ADMIN_PASSWORD required (output of provision-admin --generate)');
  process.exit(2);
}
const DOADORA = { email: 'doadora.ana@example.com', password: pw };
const EQUIPE = { email: 'equipe.carla@example.com', password: pw };
const BETO = { email: 'aluno.beto@example.com', password: pw };
const INST_A = 'Escola Horizonte da Jornada';
const MAT2 = 'Caderno de Exercícios da Jornada';
const results = [];
const check = (name, ok, extra = '') => {
  results.push([name, ok]);
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' — ' + extra : ''));
};

async function call(method, path, { token, body, headers } = {}) {
  const res = await fetch(api + path, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      'X-Repassa-Request': '1',
      ...(token ? { authorization: 'Bearer ' + token } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  return { status: res.status, data, headers: res.headers };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const apiLogin = async (email, password) => {
  let r = await call('POST', '/auth/login', { body: { email, password } });
  if (r.status === 429) {
    console.log('… login rate-limited (evidência do limiter); aguardando 62s');
    await sleep(62_000);
    r = await call('POST', '/auth/login', { body: { email, password } });
  }
  return r.status === 200 ? r : null;
};
const apiRegister = (displayName, email, password) =>
  call('POST', '/auth/register', { body: { displayName, email, password } });
async function ensureUser(displayName, email, password) {
  const existing = await apiLogin(email, password);
  if (existing) return { login: existing, created: false };
  let reg = await apiRegister(displayName, email, password);
  if (reg.status === 429) {
    console.log('… register rate-limited; aguardando 62s');
    await sleep(62_000);
    reg = await apiRegister(displayName, email, password);
  }
  return { login: { status: reg.status, data: reg.data, headers: reg.headers }, created: true, reg };
}

if (process.argv.includes('--recovery')) {
  // Phase 2 — backend was restarted; DB + issued tokens must still work.
  const health = await fetch(api + '/health').then((r) => r.status).catch(() => 0);
  check('backend saudável após restart', health === 200, 'status=' + health);
  const login = await apiLogin(BETO.email, BETO.password);
  check('login funciona após restart', !!login);
  if (login) {
    const mine = await call('GET', '/me/reservations?pageSize=20', {
      token: login.data.accessToken,
    });
    check(
      'estado persistiu após restart',
      mine.status === 200 && mine.data.total >= 2,
      'total=' + mine.data?.total,
    );
  }
  await summarize();
}

async function summarize() {
  const failed = results.filter(([, ok]) => !ok);
  console.log('\n' + (results.length - failed.length) + '/' + results.length + ' verificações de segurança ok');
  process.exit(failed.length ? 1 : 0);
}

// ---------- Phase 1 ----------
const adminLogin = await apiLogin(ADMIN.email, ADMIN.password);
const donToken = (await apiLogin(DOADORA.email, DOADORA.password))?.data.accessToken;
const betoLogin = await apiLogin(BETO.email, BETO.password);
const carlaLogin = await apiLogin(EQUIPE.email, EQUIPE.password);
const admin = adminLogin.data.accessToken;
const beto = betoLogin.data.accessToken;
const carla = carlaLogin.data.accessToken;

// 1. RBAC on admin surface
const anon = await call('GET', '/admin/institutions');
check('anônimo → 401 em /admin/institutions', anon.status === 401, 'status=' + anon.status);
const stu = await call('GET', '/admin/institutions', { token: beto });
check('STUDENT → 403 em /admin/institutions', stu.status === 403, 'status=' + stu.status);
const stf = await call('GET', '/admin/users', { token: carla });
check('STAFF → 403 em /admin/users', stf.status === 403, 'status=' + stf.status);
const stuAudit = await call('GET', '/admin/audit-events', { token: beto });
check('STUDENT → 403 em /admin/audit-events', stuAudit.status === 403, 'status=' + stuAudit.status);

// 2. Second institution (B) + dedicated staff for tenant-isolation checks
const donB = await ensureUser('Doadora Bia', 'doadora.bia@example.com', pw);
check('segunda doadora disponível', donB.login.status === 200 || donB.reg?.status === 201,
  donB.created ? 'registrada' : 'login');
await ensureUser('Equipe B', 'equipe.b@example.com', pw);
const instA = (await call('GET', '/admin/institutions?status=APPROVED&pageSize=50', { token: admin }))
  .data.items.find((i) => i.name === INST_A);
let instB = (await call('GET', '/admin/institutions?status=APPROVED&pageSize=50', { token: admin }))
  .data.items.find((i) => i.name === 'Instituto Fonte B');
if (!instB) {
  const regB = await call('POST', '/institutions', {
    token: donB.login.data.accessToken,
    body: { name: 'Instituto Fonte B', publicAddress: 'Av. Isolamento, 404 — (fictício)', pickupInstructions: 'Portaria.' },
  });
  check('instituição B registrada', regB.status === 201, 'status=' + regB.status);
  const pendB = (await call('GET', '/admin/institutions?status=PENDING&pageSize=50', { token: admin }))
    .data.items.find((i) => i.name === 'Instituto Fonte B');
  await call('POST', '/admin/institutions/' + pendB.id + '/approve', { token: admin, body: {} });
  instB = (await call('GET', '/admin/institutions?status=APPROVED&pageSize=50', { token: admin }))
    .data.items.find((i) => i.name === 'Instituto Fonte B');
}
const staffBUser = (await call('GET', '/admin/users?q=equipe.b', { token: admin })).data.items[0];
if (staffBUser.role !== 'STAFF') {
  const assign = await call('POST', '/admin/institutions/' + instB.id + '/members', {
    token: admin,
    body: { userId: staffBUser.id },
  });
  check('staff B vinculada', [200, 201].includes(assign.status), 'status=' + assign.status);
}
const staffBToken = (await apiLogin('equipe.b@example.com', pw)).data.accessToken;

// 3. Tenant isolation — staff B cannot touch institution A resources
const isoList = await call('GET', '/institutions/' + instA.id + '/materials', { token: staffBToken });
check('staff B → 403 materiais da instituição A', isoList.status === 403, 'status=' + isoList.status);
const isoDash = await call('GET', '/institutions/' + instA.id + '/dashboard', { token: staffBToken });
check('staff B → 403 dashboard da instituição A', isoDash.status === 403, 'status=' + isoDash.status);
const isoSym = await call('GET', '/institutions/' + instB.id + '/materials', { token: carla });
check('staff A → 403 materiais da instituição B', isoSym.status === 403, 'status=' + isoSym.status);
const stuManaged = await call('GET', '/institutions/' + instA.id + '/materials', { token: beto });
check('STUDENT → 403 gestão de materiais', stuManaged.status === 403, 'status=' + stuManaged.status);

// 4. Concurrency — two students race to reserve an AVAILABLE material.
// Free leftovers from previous runs first.
const caio = (await ensureUser('Aluno Caio', 'aluno.caio@example.com', pw))
  .login.data.accessToken;
for (const t of [beto, caio]) {
  const actives = (await call('GET', '/me/reservations?status=ACTIVE', { token: t })).data.items;
  for (const r of actives)
    await call('POST', '/reservations/' + r.id + '/cancel', { token: t });
}
const avail = (await call('GET', '/materials?pageSize=50')).data.items;
const mat2 = avail.find((m) => m.title === MAT2) ?? avail[0];
const [r1, r2] = await Promise.all([
  call('POST', '/materials/' + mat2.id + '/reservations', { token: beto }),
  call('POST', '/materials/' + mat2.id + '/reservations', { token: caio }),
]);
const won = [r1, r2].filter((r) => r.status === 201).length;
const lost = [r1, r2].filter((r) => r.status !== 201).length;
check(
  'corrida: exatamente uma reserva criada',
  won === 1 && lost === 1,
  r1.status + '/' + r2.status,
);
const winner = r1.status === 201 ? 'beto' : 'caio';
const winnerToken = r1.status === 201 ? beto : caio;
const active = (await call('GET', '/me/reservations?status=ACTIVE', { token: winnerToken }))
  .data.items[0];
check('reserva vencedora ACTIVE com código', !!active?.pickupCode, 'reservation=' + active?.id);

// 5. Cross-tenant pickup must be refused and reservation untouched
const xPickup = await call('POST', '/institutions/' + instA.id + '/pickups/confirm', {
  token: staffBToken,
  body: { code: active.pickupCode },
});
check('pickup cross-tenant recusado', xPickup.status >= 400, 'status=' + xPickup.status);
const still = (await call('GET', '/me/reservations?status=ACTIVE', { token: winnerToken })).data;
check(
  'reserva intacta após tentativa cross-tenant',
  still.items.some((r) => r.id === active.id && r.status === 'ACTIVE'),
);

// 6. Forced expiry — past expiresAt reconciles lazily on next availability read
const expireScript = resolve('backend/repassa-expire.local.cjs');
writeFileSync(
  expireScript,
  "const { PrismaClient } = require('@prisma/client');\n" +
    'const p = new PrismaClient();\n' +
    "p.$executeRawUnsafe(\"UPDATE reservations SET created_at = now() - interval '73 hours', expires_at = now() - interval '1 hour' WHERE id = '" +
    active.id +
    "'\").then((n) => console.log('expired', n)).finally(() => p.$disconnect());\n",
);
execFileSync(process.execPath, [expireScript], {
  cwd: 'backend',
  env: { ...process.env, DATABASE_URL: DB_URL },
  stdio: 'pipe',
});
const matsAfter = (await call('GET', '/materials?pageSize=50')).data;
check(
  'material expirado volta a AVAILABLE',
  matsAfter.items.some((m) => m.id === mat2.id && m.status === 'AVAILABLE'),
);
const resAfter = (await call('GET', '/me/reservations?status=EXPIRED', { token: winnerToken })).data;
check(
  'reserva marcada EXPIRED no histórico',
  resAfter.items.some((r) => r.id === active.id),
  resAfter.items.map((r) => r.id.slice(0, 8) + ':' + r.status).join(','),
);
const auditExp = (await call('GET', '/admin/audit-events?pageSize=50', { token: admin })).data;
check(
  'auditoria registra reservation.expire',
  auditExp.items.some((e) => e.action === 'reservation.expire' && e.reservationId === active.id),
);

// 7. Session + code opacity
const setCookie = betoLogin.headers.get('set-cookie');
check(
  'refresh cookie HttpOnly',
  /repassa_refresh=.*httponly/i.test(setCookie?.replace(/\s/g, '') ?? ''),
  setCookie?.split(';').slice(1).join(';') ?? 'sem cookie',
);
const cookiePair = setCookie?.split(';')[0];
const refresh = await call('POST', '/auth/refresh', { headers: { cookie: cookiePair } });
check('rotação do refresh emite novo access token', refresh.status === 200 && !!refresh.data.accessToken,
  'status=' + refresh.status);
const adminRes = (await call('GET', '/admin/reservations?pageSize=20', { token: admin })).data;
check(
  'código de retirada nunca exposto ao admin',
  adminRes.items.every((r) => !('pickupCode' in r) || r.pickupCode === null),
);

// 8. 409 duplicate + 429 rate limit on institution registration
const dup = await call('POST', '/institutions', {
  token: donToken,
  body: {
    name: INST_A,
    publicAddress: 'Rua da Integração, 77 — Centro (fictício)',
    pickupInstructions: 'Qualquer.',
  },
});
check('cadastro duplicado → 409', dup.status === 409, 'status=' + dup.status);
const spam = await ensureUser('Spammer Sam', 'spammer@example.com', pw);
const spamToken = spam.login.data.accessToken;
let lastStatus = 0;
let succeeded = 0;
for (let i = 1; i <= 6; i++) {
  const r = await call('POST', '/institutions', {
    token: spamToken,
    body: {
      name: 'Escola Teste ' + i + ' SH02',
      publicAddress: 'Rua Limite, ' + i,
      pickupInstructions: 'Portaria.',
    },
  });
  lastStatus = r.status;
  if (r.status === 201) succeeded++;
  else break;
}
check('rate limit: cadastro → 429 após o limite', lastStatus === 429 && succeeded <= 5,
  'ok=' + succeeded + ' último=' + lastStatus);

await summarize();
