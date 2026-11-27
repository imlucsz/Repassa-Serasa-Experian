import assert from 'node:assert/strict';
import test from 'node:test';
import { harnessEnvironmentErrors, validateDisposablePostgresUrl } from './harness-guard.mjs';

const good = {
  base: 'http://127.0.0.1:4272',
  api: 'http://127.0.0.1:3001/api/v1',
  dbUrl: 'postgresql://postgres:postgres@127.0.0.1:55434/repassa_test',
  proxyConfirmed: true,
};

test('accepts a loopback harness with explicit disposable Postgres and proxy confirmation', () => {
  assert.deepEqual(harnessEnvironmentErrors({ ...good, requireDatabase: true }), []);
});

test('rejects production frontend, API, database and proxy targets', () => {
  const errors = harnessEnvironmentErrors({
    base: 'https://repassa-serasa-experian.vercel.app',
    api: 'https://repassa-serasa-experian.onrender.com/api/v1',
    dbUrl: 'postgresql://u:p@db.example.com/repassa',
    requireDatabase: true,
    proxyTarget: 'https://repassa-serasa-experian.onrender.com',
    proxyConfirmed: true,
  });
  assert.match(errors.join('\n'), /JOURNEY_BASE/);
  assert.match(errors.join('\n'), /JOURNEY_API/);
  assert.match(errors.join('\n'), /JOURNEY_DB_URL/);
  assert.match(errors.join('\n'), /REPASSA_API_TARGET/);
});

test('rejects a local proxy whose target is production even when endpoints are local', () => {
  const errors = harnessEnvironmentErrors({ ...good, proxyTarget: 'https://repassa-serasa-experian.onrender.com' });
  assert.ok(errors.length >= 1);
  assert.match(errors[0], /REPASSA_API_TARGET/);
});

test('rejects missing proxy confirmation and non-disposable database names', () => {
  const errors = harnessEnvironmentErrors({
    ...good,
    dbUrl: 'postgresql://postgres:postgres@127.0.0.1:55434/repassa',
    requireDatabase: true,
    proxyConfirmed: false,
  });
  assert.match(errors.join('\n'), /PROXY_CONFIRMED_LOCAL/);
  assert.match(errors.join('\n'), /database name/);
});

test('accepts API-only validation without a frontend base or proxy confirmation', () => {
  assert.deepEqual(harnessEnvironmentErrors({ api: good.api, dbUrl: good.dbUrl, requireDatabase: true }), []);
});

test('rejects nested API paths as ambiguous', () => {
  assert.ok(harnessEnvironmentErrors({ ...good, api: 'http://127.0.0.1:3001/proxy/api/v1' }).length > 0);
});

test('database validation rejects non-loopback and non-postgres URLs', () => {
  assert.ok(validateDisposablePostgresUrl('mysql://127.0.0.1/repassa_test').length > 0);
  assert.ok(validateDisposablePostgresUrl('postgresql://u:p@db.example.com/repassa_test').length > 0);
});
