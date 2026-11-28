import assert from 'node:assert/strict';
import test from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CONTROLLED_STACK_KIND,
  controlledHarnessEnvironmentErrors,
  harnessEnvironmentErrors,
  validateDisposablePostgresUrl,
  validateStackManifest,
} from './harness-guard.mjs';

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


const controlled = {
  base: 'http://127.0.0.1:4272',
  api: 'http://127.0.0.1:3001/api/v1',
  dbUrl: 'postgresql://postgres:postgres@127.0.0.1:55434/repassa_test',
  adminEmail: 'admin-jornada@example.com',
  adminPassword: 'synthetic-admin-password',
};

function validManifest() {
  return {
    kind: CONTROLLED_STACK_KIND,
    version: 1,
    base: controlled.base,
    api: controlled.api,
    dbUrl: controlled.dbUrl,
    proxyTarget: 'http://127.0.0.1:3001',
    storageDriver: 'local',
    uploadDir: join(tmpdir(), 'repassa-stack-controlled', 'uploads'),
    sanitizedEnvironment: true,
    environmentNonce: '123e4567-e89b-42d3-a456-426614174000',
    verification: {
      postgresReady: true,
      migrationsApplied: true,
      backendLoginVerified: true,
      objectStorageLocal: true,
      proxyHealthVerified: true,
    },
    processes: { postgres: 101, backend: 102, frontend: 103 },
  };
}

test('accepts a complete controlled disposable stack manifest', () => {
  assert.deepEqual(
    validateStackManifest(validManifest(), { ...controlled, requireFrontend: true }),
    [],
  );
});

test('rejects controlled manifests with production storage, database or proxy drift', () => {
  const manifest = validManifest();
  manifest.dbUrl = 'postgresql://u:p@db.example.com/repassa';
  manifest.proxyTarget = 'https://repassa-serasa-experian.onrender.com';
  manifest.storageDriver = 'supabase';
  const errors = validateStackManifest(manifest, { ...controlled, requireFrontend: true });
  assert.match(errors.join('\n'), /database does not match/);
  assert.match(errors.join('\n'), /proxy target does not match/);
  assert.match(errors.join('\n'), /STORAGE_DRIVER=local/);
});

test('rejects controlled manifests without local temporary object storage or sanitized configuration', () => {
  const manifest = validManifest();
  manifest.uploadDir = join(process.cwd(), 'storage', 'uploads');
  manifest.sanitizedEnvironment = false;
  const errors = validateStackManifest(manifest, { ...controlled, requireFrontend: true });
  assert.match(errors.join('\n'), /OS temporary directory/);
  assert.match(errors.join('\n'), /sanitized non-inherited/);
});

function okFetch() {
  return async () => ({ ok: true, status: 200, headers: new Map() });
}

test('controlled preflight accepts verified local endpoints and database login proofs', async () => {
  const errors = await controlledHarnessEnvironmentErrors(
    { ...controlled, manifest: validManifest(), requireFrontend: true },
    { fetchImpl: okFetch(), noncePresent: async () => true, loginProof: async () => true },
  );
  assert.deepEqual(errors, []);
});

test('controlled preflight rejects redirects, unreachable mutation destinations and missing launcher proof', async () => {
  const redirecting = async (url) => ({
    ok: false,
    status: url.includes('/api/v1/health') ? 302 : 200,
    headers: new Map([['location', 'https://repassa-serasa-experian.onrender.com/api/v1/health']]),
  });
  const errors = await controlledHarnessEnvironmentErrors(
    { ...controlled, manifest: validManifest(), requireFrontend: true },
    { fetchImpl: redirecting, noncePresent: async () => false, loginProof: async () => true },
  );
  assert.match(errors.join('\n'), /unexpectedly redirects/);
  assert.match(errors.join('\n'), /launcher login proof was not found/);
});

test('controlled preflight rejects a missing manifest before any endpoint verification', async () => {
  let fetched = 0;
  const errors = await controlledHarnessEnvironmentErrors(
    { ...controlled, requireFrontend: true },
    {
      fetchImpl: async () => {
        fetched += 1;
        return { ok: true, status: 200, headers: new Map() };
      },
      noncePresent: async () => true,
      loginProof: async () => true,
    },
  );
  assert.match(errors.join('\n'), /JOURNEY_STACK_MANIFEST/);
  assert.equal(fetched, 0);
});


test('controlled preflight rejects when the current backend login does not reach the disposable database', async () => {
  const errors = await controlledHarnessEnvironmentErrors(
    { ...controlled, manifest: validManifest(), requireFrontend: true },
    { fetchImpl: okFetch(), noncePresent: async () => true, loginProof: async () => false },
  );
  assert.match(errors.join('\n'), /current backend login did not mutate/);
});
