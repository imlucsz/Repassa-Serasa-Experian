import { validateEnv } from '../../src/config/env.validation';

const BASE = {
  DATABASE_URL: 'postgresql://repassa_ci:repassa_ci@127.0.0.1:5432/repassa_ci',
};

function issues(run: () => unknown): string {
  try {
    run();
    return '';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

describe('validateEnv', () => {
  it('accepts a minimal valid configuration with safe defaults', () => {
    const config = validateEnv({ ...BASE });
    expect(config.nodeEnv).toBe('development');
    expect(config.port).toBe(3001);
    expect(config.host).toBe('0.0.0.0');
    expect(config.allowedOrigins).toEqual(['http://localhost:3000']);
    expect(config.trustProxy).toBe(false);
    expect(config.swaggerEnabled).toBe(true);
  });

  it('requires DATABASE_URL', () => {
    expect(issues(() => validateEnv({}))).toContain('DATABASE_URL is required');
  });

  it('rejects non-postgres DATABASE_URL', () => {
    expect(issues(() => validateEnv({ DATABASE_URL: 'mysql://x' }))).toContain('postgresql');
    expect(issues(() => validateEnv({ DATABASE_URL: 'not a url' }))).toContain('not a valid URL');
  });

  it('validates PORT range', () => {
    expect(issues(() => validateEnv({ ...BASE, PORT: 'abc' }))).toContain('PORT');
    expect(issues(() => validateEnv({ ...BASE, PORT: '70000' }))).toContain('PORT');
    expect(validateEnv({ ...BASE, PORT: '4000' }).port).toBe(4000);
  });

  it('rejects invalid NODE_ENV', () => {
    expect(issues(() => validateEnv({ ...BASE, NODE_ENV: 'staging' }))).toContain('NODE_ENV');
  });

  it('requires ALLOWED_ORIGINS in production and validates entries', () => {
    expect(
      issues(() => validateEnv({ ...BASE, NODE_ENV: 'production' })),
    ).toContain('ALLOWED_ORIGINS is required in production');

    const prod = validateEnv({
      ...BASE,
      NODE_ENV: 'production',
      ALLOWED_ORIGINS: 'https://repassa.example.com',
      JWT_ACCESS_SECRET: 'x'.repeat(32),
    });
    expect(prod.allowedOrigins).toEqual(['https://repassa.example.com']);
    expect(prod.swaggerEnabled).toBe(false); // default off in production
  });

  it('rejects http origins outside localhost and origins with paths', () => {
    expect(
      issues(() => validateEnv({ ...BASE, ALLOWED_ORIGINS: 'http://evil.example.com' })),
    ).toContain('https');
    expect(
      issues(() => validateEnv({ ...BASE, ALLOWED_ORIGINS: 'https://x.example.com/path' })),
    ).toContain('bare origin');
  });

  it('parses multiple allowed origins', () => {
    const config = validateEnv({
      ...BASE,
      ALLOWED_ORIGINS: 'http://localhost:3000, https://repassa.example.com',
    });
    expect(config.allowedOrigins).toHaveLength(2);
  });

  it('validates booleans strictly', () => {
    expect(issues(() => validateEnv({ ...BASE, TRUST_PROXY: 'yes' }))).toContain('TRUST_PROXY');
    expect(issues(() => validateEnv({ ...BASE, SWAGGER_ENABLED: '1' }))).toContain(
      'SWAGGER_ENABLED',
    );
    expect(validateEnv({ ...BASE, TRUST_PROXY: 'true' }).trustProxy).toBe(true);
  });

  it('enforces minimum length on secrets when provided', () => {
    expect(issues(() => validateEnv({ ...BASE, JWT_ACCESS_SECRET: 'short' }))).toContain(
      'JWT_ACCESS_SECRET',
    );
    expect(
      issues(() => validateEnv({ ...BASE, SEED_DEMO_PASSWORD: 'short' })),
    ).toContain('SEED_DEMO_PASSWORD');
    const ok = validateEnv({ ...BASE, JWT_ACCESS_SECRET: 'x'.repeat(32) });
    expect(ok.jwtAccessSecret).toHaveLength(32);
  });

  it('collects multiple errors at once', () => {
    const message = issues(() => validateEnv({ PORT: 'abc', TRUST_PROXY: 'maybe' }));
    expect(message).toContain('DATABASE_URL');
    expect(message).toContain('PORT');
    expect(message).toContain('TRUST_PROXY');
  });

  it('requires JWT_ACCESS_SECRET in production but not in dev/test', () => {
    expect(
      issues(() =>
        validateEnv({
          ...BASE,
          NODE_ENV: 'production',
          ALLOWED_ORIGINS: 'https://repassa.example.com',
        }),
      ),
    ).toContain('JWT_ACCESS_SECRET is required in production');
    expect(
      issues(() =>
        validateEnv({
          ...BASE,
          NODE_ENV: 'production',
          ALLOWED_ORIGINS: 'https://repassa.example.com',
          JWT_ACCESS_SECRET: 'x'.repeat(32),
        }),
      ),
    ).toBe('');
    expect(validateEnv({ ...BASE }).jwtAccessSecret).toBeUndefined();
  });

  it('applies documented TTL defaults and validates provided ranges', () => {
    const config = validateEnv({ ...BASE });
    expect(config.accessTokenTtlSeconds).toBe(900);
    expect(config.refreshTokenTtlDays).toBe(7);
    expect(
      issues(() => validateEnv({ ...BASE, ACCESS_TOKEN_TTL_SECONDS: '30' })),
    ).toContain('ACCESS_TOKEN_TTL_SECONDS');
    expect(
      issues(() => validateEnv({ ...BASE, REFRESH_TOKEN_TTL_DAYS: '0' })),
    ).toContain('REFRESH_TOKEN_TTL_DAYS');
    expect(
      validateEnv({ ...BASE, ACCESS_TOKEN_TTL_SECONDS: '300', REFRESH_TOKEN_TTL_DAYS: '14' })
        .accessTokenTtlSeconds,
    ).toBe(300);
  });

  it('defaults COOKIE_SECURE off outside production and forces it on in production', () => {
    expect(validateEnv({ ...BASE }).cookieSecure).toBe(false);
    const prod = validateEnv({
      ...BASE,
      NODE_ENV: 'production',
      ALLOWED_ORIGINS: 'https://repassa.example.com',
      JWT_ACCESS_SECRET: 'x'.repeat(32),
    });
    expect(prod.cookieSecure).toBe(true);
    expect(
      issues(() =>
        validateEnv({
          ...BASE,
          NODE_ENV: 'production',
          ALLOWED_ORIGINS: 'https://repassa.example.com',
          JWT_ACCESS_SECRET: 'x'.repeat(32),
          COOKIE_SECURE: 'false',
        }),
      ),
    ).toContain('COOKIE_SECURE cannot be false in production');
    expect(issues(() => validateEnv({ ...BASE, COOKIE_SECURE: 'maybe' }))).toContain(
      'COOKIE_SECURE',
    );
    expect(validateEnv({ ...BASE, COOKIE_SECURE: 'true' }).cookieSecure).toBe(true);
  });
});
