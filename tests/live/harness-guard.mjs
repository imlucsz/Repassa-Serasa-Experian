// Fail-closed environment validation for the optional mutating SH-02 harness.
// The harness is only for loopback services backed by an explicitly disposable
// PostgreSQL database. There is intentionally no nonlocal opt-out.
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

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
