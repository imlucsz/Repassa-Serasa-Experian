#!/usr/bin/env node
/**
 * RePassa post-deploy smoke test (staging). Read-mostly checks plus one
 * synthetic student registration when SMOKE_* creds are provided.
 *
 * Usage:
 *   node scripts/smoke.mjs --base https://repassa-staging.vercel.app
 *     [--api https://repassa-api-staging.onrender.com]   (direct API checks)
 *     [--email smoke@example.com --password <pw>]        (auth flow checks)
 *
 * Exit 0 on success, 1 on any failure. Safe to run repeatedly: the synthetic
 * user is created once; a second run exercises login on the same account.
 */

const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

const BASE = (flag('base') ?? process.env.SMOKE_BASE_URL ?? '').replace(/\/+$/, '');
const API = (flag('api') ?? process.env.SMOKE_API_URL ?? BASE).replace(/\/+$/, '');
const EMAIL = flag('email') ?? process.env.SMOKE_EMAIL;
const PASSWORD = flag('password') ?? process.env.SMOKE_PASSWORD;

if (!BASE) {
  console.error('usage: smoke.mjs --base <url> [--api <url>] [--email <e> --password <p>]');
  process.exit(1);
}

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const JSON_HEADERS = { 'x-repassa-request': '1', 'content-type': 'application/json' };

async function get(url, headers = {}) {
  return fetch(url, { headers, redirect: 'manual' });
}
async function post(url, body, headers = {}) {
  return fetch(url, { method: 'POST', headers: { ...JSON_HEADERS, ...headers }, body: JSON.stringify(body) });
}

// --- Infrastructure checks (through the same-origin proxy) ---------------
const live = await get(`${BASE}/api/v1/health/live`);
check('liveness via proxy', live.status === 200, `status=${live.status}`);

const ready = await get(`${BASE}/api/v1/health`);
check('readiness (DB) via proxy', ready.status === 200, `status=${ready.status}`);
check(
  'API no-store header',
  (ready.headers.get('cache-control') ?? '').includes('no-store'),
  ready.headers.get('cache-control') ?? 'absent',
);

// CORS: disallowed origin must not receive credentialed CORS headers.
const preflight = await fetch(`${BASE}/api/v1/health`, {
  method: 'OPTIONS',
  headers: {
    origin: 'https://evil.example.com',
    'access-control-request-method': 'POST',
    'access-control-request-headers': 'content-type,authorization',
  },
});
check(
  'CORS rejects foreign origin',
  !preflight.headers.get('access-control-allow-origin'),
  `acao=${preflight.headers.get('access-control-allow-origin') ?? 'none'}`,
);

// CSRF marker: auth mutation without the marker header must be rejected.
const noMarker = await fetch(`${BASE}/api/v1/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'x@x.com', password: 'x'.repeat(12) }),
});
check('CSRF marker enforced', noMarker.status === 403, `status=${noMarker.status}`);

// --- Authenticated flow (optional, synthetic user) ------------------------
if (EMAIL && PASSWORD) {
  const jar = { cookie: '' };
  const send = async (method, path, body) => {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { ...JSON_HEADERS, ...(jar.cookie ? { cookie: jar.cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) jar.cookie = setCookie.split(';')[0];
    return res;
  };

  let res = await send('POST', '/api/v1/auth/register', {
    email: EMAIL,
    password: PASSWORD,
    displayName: 'Smoke Test User',
  });
  if (res.status === 409) {
    res = await send('POST', '/api/v1/auth/login', { email: EMAIL, password: PASSWORD });
  }
  const rawCookie = (n) =>
    fetch(`${BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
      redirect: 'manual',
    }).then((r) => r.headers.get('set-cookie') ?? '');
  check('register/login', res.status === 200 || res.status === 201, `status=${res.status}`);
  const authBody = res.ok ? await res.json() : {};
  const accessToken = authBody.accessToken;

  const cookie = await rawCookie();
  check('refresh cookie HttpOnly', /httponly/i.test(cookie));
  check('refresh cookie SameSite=Strict', /samesite=strict/i.test(cookie));
  check('refresh cookie Path=/api/v1/auth', /path=\/api\/v1\/auth/i.test(cookie));
  if (BASE.startsWith('https:')) check('refresh cookie Secure', /secure/i.test(cookie));

  const me = await get(`${BASE}/api/v1/me`, { authorization: `Bearer ${accessToken}` });
  check('session access token', me.status === 200, `status=${me.status}`);

  const refresh = await send('POST', '/api/v1/auth/refresh');
  check('cookie refresh rotation', refresh.status === 200, `status=${refresh.status}`);
  const refreshed = refresh.ok ? await refresh.json() : {};

  const logout = await send('POST', '/api/v1/auth/logout');
  check('logout', logout.status === 204, `status=${logout.status}`);

  const meAfter = await get(`${BASE}/api/v1/me`, {
    authorization: `Bearer ${refreshed.accessToken}`,
  });
  check('old family revoked post-logout', meAfter.status === 401, `status=${meAfter.status}`);
} else {
  console.log('SKIP  auth flow — provide --email/--password for end-to-end session checks');
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
