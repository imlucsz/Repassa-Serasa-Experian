// Fail-closed environment validation for the optional mutating SH-02 harness.
// The harness is only for a controlled loopback stack backed by an explicitly
// disposable PostgreSQL database. There is intentionally no nonlocal opt-out.
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, resolve, sep } from 'node:path';
import { createBackendPrisma } from './backend-prisma.mjs';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
export const CONTROLLED_STACK_KIND = 'repassa-controlled-disposable-stack';
const AUDIT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function loopbackHostname(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return { url, host: url.hostname.replace(/^\[|\]$/g, '').toLowerCase() };
  } catch {
    return { url: null, host: '' };
  }
}

function validateLoopbackHttp(rawUrl, name, errors, { requiredPath } = {}) {
  const { url, host } = loopbackHostname(rawUrl);
  if (!url) {
    errors.push(`${name} is not a valid URL`);
    return;
  }
  if (url.protocol !== 'http:') errors.push(`${name} must use plain local http://`);
  if (!LOOPBACK_HOSTS.has(host) && !LOOPBACK_HOSTS.has(url.hostname.toLowerCase()))
    errors.push(`${name} must use localhost, 127.0.0.1 or ::1`);
  if (url.username || url.password) errors.push(`${name} must not contain credentials`);
  if (requiredPath && url.pathname.replace(/\/$/, '') !== requiredPath)
    errors.push(`${name} path must be exactly ${requiredPath}`);
}

export function validateDisposablePostgresUrl(rawUrl, errors = []) {
  const { url, host } = loopbackHostname(rawUrl);
  if (!url) {
    errors.push('JOURNEY_DB_URL is not a valid URL');
    return errors;
  }
  if (!['postgresql:', 'postgres:'].includes(url.protocol))
    errors.push('JOURNEY_DB_URL must use postgresql://');
  if (!LOOPBACK_HOSTS.has(host) && !LOOPBACK_HOSTS.has(url.hostname.toLowerCase()))
    errors.push('JOURNEY_DB_URL must use localhost, 127.0.0.1 or ::1');
  const database = decodeURIComponent(url.pathname.replace(/^\//, '')).toLowerCase();
  if (!/(^|[_-])(test|disposable|journey)([_-]|$)/.test(database))
    errors.push('JOURNEY_DB_URL database name must explicitly contain test, disposable or journey');
  return errors;
}

export function harnessEnvironmentErrors({
  base,
  api,
  dbUrl,
  requireDatabase = false,
  proxyTarget,
  proxyConfirmed = false,
} = {}) {
  const errors = [];
  if (base) validateLoopbackHttp(base, 'JOURNEY_BASE', errors);
  validateLoopbackHttp(api, 'JOURNEY_API', errors, { requiredPath: '/api/v1' });
  if (requireDatabase) validateDisposablePostgresUrl(dbUrl, errors);
  if (base && !proxyConfirmed)
    errors.push('JOURNEY_FRONTEND_PROXY_CONFIRMED_LOCAL=1 is required after verifying the frontend dev-server proxy target');
  if (proxyTarget) validateLoopbackHttp(proxyTarget, 'REPASSA_API_TARGET', errors);
  return errors;
}

export function assertSafeHarnessEnvironment(options) {
  const errors = harnessEnvironmentErrors(options);
  if (errors.length) {
    throw new Error(
      'Unsafe or ambiguous live-harness environment; refusing before any mutation:\n- ' +
        errors.join('\n- '),
    );
  }
}

function trimTrailingSlash(value) {
  return typeof value === 'string' ? value.replace(/\/+$/, '') : '';
}

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function withinTemporaryDirectory(rawPath) {
  if (typeof rawPath !== 'string' || !rawPath || !isAbsolute(rawPath)) return false;
  const temp = resolve(tmpdir());
  const target = resolve(rawPath);
  const lower = process.platform === 'win32' ? (v) => v.toLowerCase() : (v) => v;
  const tempNormalized = lower(temp);
  const targetNormalized = lower(target);
  return targetNormalized.startsWith(tempNormalized + sep);
}

function verificationEnabled(manifest, key) {
  return manifest?.verification?.[key] === true;
}

// The manifest is the controlled launcher's attestation. It is deliberately
// strict: a hand-written or partial manifest is treated as ambiguous and fails.
export function validateStackManifest(
  manifest,
  { base, api, dbUrl, requireFrontend = false } = {},
) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return ['controlled stack manifest is not an object'];
  }
  if (manifest.kind !== CONTROLLED_STACK_KIND)
    errors.push('controlled stack manifest kind is not recognized');
  if (manifest.version !== 1) errors.push('controlled stack manifest version must be 1');

  if (trimTrailingSlash(manifest.api) !== trimTrailingSlash(api))
    errors.push('controlled stack manifest API does not match JOURNEY_API');
  if (trimTrailingSlash(manifest.dbUrl) !== trimTrailingSlash(dbUrl))
    errors.push('controlled stack manifest database does not match JOURNEY_DB_URL');
  if (requireFrontend && trimTrailingSlash(manifest.base) !== trimTrailingSlash(base))
    errors.push('controlled stack manifest frontend does not match JOURNEY_BASE');

  if (manifest.api) validateLoopbackHttp(manifest.api, 'manifest api', errors, { requiredPath: '/api/v1' });
  else errors.push('controlled stack manifest is missing api');
  if (requireFrontend) {
    if (manifest.base) validateLoopbackHttp(manifest.base, 'manifest base', errors);
    else errors.push('controlled stack manifest is missing base');
  }
  if (manifest.dbUrl) validateDisposablePostgresUrl(manifest.dbUrl, errors);
  else errors.push('controlled stack manifest is missing dbUrl');

  let expectedApiOrigin = '';
  try {
    expectedApiOrigin = new URL(api).origin;
  } catch {
    expectedApiOrigin = '';
  }
  if (trimTrailingSlash(manifest.proxyTarget) !== expectedApiOrigin)
    errors.push('controlled stack manifest Vite proxy target does not match the intended local backend');
  if (manifest.proxyTarget) validateLoopbackHttp(manifest.proxyTarget, 'manifest proxy target', errors);

  if (manifest.storageDriver !== 'local')
    errors.push('controlled stack manifest must use STORAGE_DRIVER=local');
  if (!withinTemporaryDirectory(manifest.uploadDir))
    errors.push('controlled stack manifest uploadDir must be inside the OS temporary directory');
  if (manifest.sanitizedEnvironment !== true)
    errors.push('controlled stack manifest does not attest sanitized non-inherited app configuration');
  if (typeof manifest.environmentNonce !== 'string' || !AUDIT_UUID.test(manifest.environmentNonce))
    errors.push('controlled stack manifest is missing a valid backend-login proof audit id');

  for (const key of ['postgresReady', 'migrationsApplied', 'backendLoginVerified', 'objectStorageLocal']) {
    if (!verificationEnabled(manifest, key))
      errors.push(`controlled stack manifest verification.${key} is not true`);
  }
  if (requireFrontend && !verificationEnabled(manifest, 'proxyHealthVerified'))
    errors.push('controlled stack manifest verification.proxyHealthVerified is not true');

  if (!positiveInteger(manifest.processes?.postgres))
    errors.push('controlled stack manifest is missing the PostgreSQL process id');
  if (!positiveInteger(manifest.processes?.backend))
    errors.push('controlled stack manifest is missing the backend process id');
  if (requireFrontend && !positiveInteger(manifest.processes?.frontend))
    errors.push('controlled stack manifest is missing the frontend process id');
  return errors;
}

export async function readStackManifest(manifestPath, errors = []) {
  if (!manifestPath) {
    errors.push('JOURNEY_STACK_MANIFEST is required and must point at the controlled local launcher manifest');
    return null;
  }
  try {
    return JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    errors.push('controlled stack manifest cannot be read or parsed: ' + (error?.message ?? error));
    return null;
  }
}

async function checkNoRedirectingEndpoint(fetchImpl, url, name, errors) {
  try {
    const response = await fetchImpl(url, { redirect: 'manual' });
    if (response.status >= 300 && response.status < 400) {
      errors.push(`${name} unexpectedly redirects with status ${response.status}`);
      return;
    }
    if (!response.ok) errors.push(`${name} readiness returned HTTP ${response.status}`);
  } catch (error) {
    errors.push(`${name} cannot be reached locally: ${error?.message ?? error}`);
  }
}

export async function manifestNoncePresent(databaseUrl, environmentNonce) {
  const prisma = createBackendPrisma(databaseUrl);
  try {
    const rows = await prisma.$queryRaw`
      SELECT count(*)::int AS count
      FROM audit_events
      WHERE id = CAST(${environmentNonce} AS uuid)
        AND action = 'auth.login'`;
    return rows[0]?.count === 1;
  } finally {
    await prisma.$disconnect();
  }
}

async function loginAuditCount(prisma, adminEmail) {
  const rows = await prisma.$queryRaw`
    SELECT count(*)::int AS count
    FROM audit_events ae
    JOIN users u ON u.id = ae.actor_id
    WHERE ae.action = 'auth.login'
      AND u.email = ${adminEmail}`;
  return rows[0]?.count ?? 0;
}

// Runtime proof for the current backend process: an API login must produce
// exactly one new auth.login audit row in the validated disposable database.
// This catches a lookalike local backend that was restarted against another
// database after the controlled launcher wrote its manifest.
export async function backendLoginProofPresent(
  { api, databaseUrl, adminEmail, adminPassword },
  { fetchImpl = fetch } = {},
) {
  const prisma = createBackendPrisma(databaseUrl);
  try {
    const before = await loginAuditCount(prisma, adminEmail);
    const response = await fetchImpl(api + '/auth/login', {
      method: 'POST',
      redirect: 'manual',
      headers: { 'content-type': 'application/json', 'X-Repassa-Request': '1' },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    if ((response.status >= 300 && response.status < 400) || !response.ok) return false;
    return (await loginAuditCount(prisma, adminEmail)) === before + 1;
  } finally {
    await prisma.$disconnect();
  }
}

export async function controlledHarnessEnvironmentErrors(
  { base, api, dbUrl, manifestPath, manifest, requireFrontend = false, adminEmail, adminPassword } = {},
  { fetchImpl = fetch, noncePresent = manifestNoncePresent, loginProof = backendLoginProofPresent } = {},
) {
  const errors = harnessEnvironmentErrors({
    base,
    api,
    dbUrl,
    requireDatabase: true,
    proxyConfirmed: true,
  });
  const stackManifest = manifest ?? (await readStackManifest(manifestPath, errors));
  if (stackManifest)
    errors.push(...validateStackManifest(stackManifest, { base, api, dbUrl, requireFrontend }));
  if (errors.length) return errors;

  await checkNoRedirectingEndpoint(fetchImpl, api + '/health', 'JOURNEY_API /health', errors);
  if (requireFrontend) {
    await checkNoRedirectingEndpoint(fetchImpl, base + '/api/v1/health', 'JOURNEY_BASE proxied /api/v1/health', errors);
    await checkNoRedirectingEndpoint(fetchImpl, base + '/', 'JOURNEY_BASE frontend', errors);
  }
  if (!(await noncePresent(dbUrl, stackManifest.environmentNonce).catch(() => false)))
    errors.push('controlled launcher login proof was not found exactly once in the disposable database');
  if (
    !adminPassword ||
    !(await loginProof(
      { api, databaseUrl: dbUrl, adminEmail, adminPassword },
      { fetchImpl },
    ).catch(() => false))
  )
    errors.push('current backend login did not mutate the validated disposable database exactly once');
  return errors;
}

export async function assertControlledHarnessEnvironment(options, dependencies) {
  const errors = await controlledHarnessEnvironmentErrors(options, dependencies);
  if (errors.length) {
    throw new Error(
      'Unsafe or ambiguous controlled live-harness environment; refusing before any mutation:\n- ' +
        errors.join('\n- '),
    );
  }
}
