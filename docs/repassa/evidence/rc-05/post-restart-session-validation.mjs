// Post-restart opaque-session recovery probe for the controlled disposable stack.
// Prints no token or cookie material.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const api = process.env.JOURNEY_API ?? 'http://127.0.0.1:3001/api/v1';
const manifest = JSON.parse(await readFile(process.env.JOURNEY_STACK_MANIFEST, 'utf8'));
const saved = JSON.parse(await readFile(join(manifest.uploadDir, '..', 'recovery-session.json'), 'utf8'));
const results = [];
const check = (name, ok, extra = '') => {
  results.push([name, ok]);
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' — ' + extra : ''));
};
async function call(method, path, { token, cookie } = {}) {
  const headers = { 'X-Repassa-Request': '1' };
  if (token) headers.authorization = 'Bearer ' + token;
  if (cookie) headers.cookie = cookie;
  const res = await fetch(api + path, { method, headers, redirect: 'manual' });
  const type = res.headers.get('content-type') ?? '';
  return { status: res.status, data: type.includes('application/json') ? await res.json().catch(() => null) : null, headers: res.headers };
}

const health = await fetch(api + '/health', { redirect: 'manual' }).then((r) => r.status).catch(() => 0);
check('backend saudável após restart controlado', health === 200, 'status=' + health);
const rotated = await call('POST', '/auth/refresh', { cookie: saved.cookiePair });
check('refresh opaco emitido antes do restart rotaciona depois dele', rotated.status === 200 && !!rotated.data?.accessToken, 'status=' + rotated.status);
const replay = await call('POST', '/auth/refresh', { cookie: saved.cookiePair });
check('cookie substituído não pode ser reutilizado', replay.status === 401, 'status=' + replay.status);
if (rotated.status === 200) {
  const me = await call('GET', '/me', { token: rotated.data.accessToken });
  check('novo access token pós-restart autoriza /me', me.status === 200 && me.data?.email === saved.email, 'status=' + me.status);
  const donations = await call('GET', '/me/donations?pageSize=50', { token: rotated.data.accessToken });
  check('histórico persistido acessível pela sessão recuperada',
    donations.status === 200 && donations.data.items.some((d) => d.id === saved.materialId),
    'status=' + donations.status);
}
const failed = results.filter(([, ok]) => !ok);
console.log('\n' + (results.length - failed.length) + '/' + results.length + ' verificações de sessão pós-restart ok');
process.exit(failed.length ? 1 : 0);
