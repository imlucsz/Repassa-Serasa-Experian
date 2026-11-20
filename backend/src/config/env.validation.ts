/**
 * Startup environment validation for ConfigModule.forRoot({ validate }).
 * Fails fast on invalid config; never silently falls back to insecure values.
 * See docs/repassa/SECURITY.md for the security model these defaults support.
 */

export interface EnvConfig {
  nodeEnv: 'development' | 'test' | 'production';
  host: string;
  port: number;
  databaseUrl: string;
  allowedOrigins: string[];
  trustProxy: boolean;
  swaggerEnabled: boolean;
  logLevel: string;
  /**
   * HS256 secret for access tokens. Required in production; in development and
   * test an ephemeral per-process secret is generated (sessions do not survive
   * restarts) so no insecure default is ever committed.
   */
  jwtAccessSecret?: string;
  pickupCodeSecret?: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlDays: number;
  /**
   * `Secure` attribute on the refresh cookie. Forced true in production
   * (HTTPS only); may be enabled explicitly for local HTTPS testing.
   */
  cookieSecure: boolean;
  /** Local disk directory for processed upload objects (private; served via controlled route). */
  uploadDir: string;
  seedDemoPassword?: string;
}

export const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 900;
export const DEFAULT_REFRESH_TOKEN_TTL_DAYS = 7;

const NODE_ENVS = ['development', 'test', 'production'] as const;
const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];

function isBooleanString(v: string): boolean {
  return v === 'true' || v === 'false';
}

function parsePort(raw: string | undefined, errors: string[]): number {
  if (raw === undefined || raw === '') return 3001;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push('PORT must be an integer between 1 and 65535');
    return 3001;
  }
  return port;
}

function parseDatabaseUrl(raw: string | undefined, errors: string[]): string {
  if (!raw) {
    errors.push('DATABASE_URL is required');
    return '';
  }
  try {
    const url = new URL(raw);
    if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
      errors.push('DATABASE_URL must use the postgresql:// scheme');
    }
  } catch {
    errors.push('DATABASE_URL is not a valid URL');
  }
  return raw;
}

function parseAllowedOrigins(
  raw: string | undefined,
  nodeEnv: EnvConfig['nodeEnv'],
  errors: string[],
): string[] {
  if (!raw || raw.trim() === '') {
    if (nodeEnv === 'production') {
      errors.push('ALLOWED_ORIGINS is required in production (comma-separated https origins)');
      return [];
    }
    return ['http://localhost:3000'];
  }
  const origins = raw
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
  for (const origin of origins) {
    try {
      const url = new URL(origin);
      if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocalHostname(url.hostname))) {
        errors.push(`ALLOWED_ORIGINS entry "${origin}" must be https, or http on localhost only`);
      }
      if (url.pathname !== '/' || url.search || url.hash) {
        errors.push(`ALLOWED_ORIGINS entry "${origin}" must be a bare origin (no path/query)`);
      }
    } catch {
      errors.push(`ALLOWED_ORIGINS entry "${origin}" is not a valid origin`);
    }
  }
  return origins;
}

function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';
}

function parseOptionalSecret(
  name: string,
  raw: string | undefined,
  minLength: number,
  errors: string[],
): string | undefined {
  if (raw === undefined || raw === '') return undefined;
  if (raw.length < minLength) {
    errors.push(`${name} must be at least ${minLength} characters when set`);
    return undefined;
  }
  return raw;
}

function parseOptionalInt(
  name: string,
  raw: string | undefined,
  min: number,
  max: number,
  errors: string[],
): number | undefined {
  if (raw === undefined || raw === '') return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    errors.push(`${name} must be an integer between ${min} and ${max}`);
    return undefined;
  }
  return value;
}

export function validateEnv(raw: Record<string, unknown>): EnvConfig {
  const env = (k: string) => (typeof raw[k] === 'string' ? (raw[k] as string) : undefined);
  const errors: string[] = [];

  const nodeEnvRaw = env('NODE_ENV') ?? 'development';
  const nodeEnv = (NODE_ENVS as readonly string[]).includes(nodeEnvRaw)
    ? (nodeEnvRaw as EnvConfig['nodeEnv'])
    : 'development';
  if (!(NODE_ENVS as readonly string[]).includes(nodeEnvRaw)) {
    errors.push(`NODE_ENV must be one of ${NODE_ENVS.join('|')}`);
  }

  const trustProxyRaw = env('TRUST_PROXY') ?? 'false';
  if (!isBooleanString(trustProxyRaw)) errors.push('TRUST_PROXY must be "true" or "false"');

  const swaggerRaw = env('SWAGGER_ENABLED');
  if (swaggerRaw !== undefined && !isBooleanString(swaggerRaw)) {
    errors.push('SWAGGER_ENABLED must be "true" or "false"');
  }
  const swaggerEnabled = swaggerRaw !== undefined ? swaggerRaw === 'true' : nodeEnv !== 'production';

  const logLevel = env('LOG_LEVEL') ?? 'info';
  if (!LOG_LEVELS.includes(logLevel)) {
    errors.push(`LOG_LEVEL must be one of ${LOG_LEVELS.join('|')}`);
  }

  const jwtAccessSecret = parseOptionalSecret('JWT_ACCESS_SECRET', env('JWT_ACCESS_SECRET'), 32, errors);
  if (!jwtAccessSecret && nodeEnv === 'production') {
    errors.push('JWT_ACCESS_SECRET is required in production (>=32 chars)');
  }

  const cookieSecureRaw = env('COOKIE_SECURE');
  if (cookieSecureRaw !== undefined && cookieSecureRaw !== '' && !isBooleanString(cookieSecureRaw)) {
    errors.push('COOKIE_SECURE must be "true" or "false"');
  }
  const cookieSecure =
    cookieSecureRaw === undefined || cookieSecureRaw === ''
      ? nodeEnv === 'production'
      : cookieSecureRaw === 'true';
  if (!cookieSecure && nodeEnv === 'production') {
    errors.push('COOKIE_SECURE cannot be false in production (refresh cookie requires Secure)');
  }

  const config: EnvConfig = {
    nodeEnv,
    host: env('HOST') ?? '0.0.0.0',
    port: parsePort(env('PORT'), errors),
    databaseUrl: parseDatabaseUrl(env('DATABASE_URL'), errors),
    allowedOrigins: parseAllowedOrigins(env('ALLOWED_ORIGINS'), nodeEnv, errors),
    trustProxy: trustProxyRaw === 'true',
    swaggerEnabled,
    logLevel,
    jwtAccessSecret,
    pickupCodeSecret: parseOptionalSecret('PICKUP_CODE_SECRET', env('PICKUP_CODE_SECRET'), 32, errors),
    accessTokenTtlSeconds:
      parseOptionalInt('ACCESS_TOKEN_TTL_SECONDS', env('ACCESS_TOKEN_TTL_SECONDS'), 60, 3600, errors) ??
      DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenTtlDays:
      parseOptionalInt('REFRESH_TOKEN_TTL_DAYS', env('REFRESH_TOKEN_TTL_DAYS'), 1, 90, errors) ??
      DEFAULT_REFRESH_TOKEN_TTL_DAYS,
    cookieSecure,
    uploadDir: env('UPLOAD_DIR')?.trim() || 'storage/uploads',
    seedDemoPassword: parseOptionalSecret('SEED_DEMO_PASSWORD', env('SEED_DEMO_PASSWORD'), 12, errors),
  };

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration:\n - ${errors.join('\n - ')}`);
  }
  return config;
}
