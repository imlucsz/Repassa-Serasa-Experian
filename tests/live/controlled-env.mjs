// Environment keys that can change the backend/frontend safety posture. The
// controlled launcher removes them from inherited environments, then sets its
// own explicit local values. OS/toolchain variables are preserved.
export const CONTROLLED_APP_ENV_KEYS = new Set([
  'NODE_ENV',
  'HOST',
  'PORT',
  'DATABASE_URL',
  'TEST_DATABASE_URL',
  'ALLOWED_ORIGINS',
  'TRUST_PROXY',
  'SWAGGER_ENABLED',
  'LOG_LEVEL',
  'JWT_ACCESS_SECRET',
  'PICKUP_CODE_SECRET',
  'ACCESS_TOKEN_TTL_SECONDS',
  'REFRESH_TOKEN_TTL_DAYS',
  'COOKIE_SECURE',
  'UPLOAD_DIR',
  'STORAGE_DRIVER',
  'SEED_DEMO_PASSWORD',
  'REPASSA_API_TARGET',
  'VITE_DATA_MODE',
]);

export function sanitizedInheritedEnv(source = process.env) {
  const env = {};
  for (const [key, value] of Object.entries(source)) {
    if (
      CONTROLLED_APP_ENV_KEYS.has(key) ||
      key.startsWith('SUPABASE_') ||
      key.startsWith('JOURNEY_') ||
      key.startsWith('VITE_') ||
      key.startsWith('REPASSA_') ||
      key.startsWith('PG')
    )
      continue;
    if (value !== undefined) env[key] = value;
  }
  return env;
}
