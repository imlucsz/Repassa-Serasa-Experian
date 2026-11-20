/**
 * E2E/integration tests — run against a disposable PostgreSQL:
 * TEST_DATABASE_URL when provided (CI postgres:16), otherwise an embedded
 * Postgres 16 child process is booted and migrations are applied.
 * Runs in Jest ESM mode (@nestjs/* ships ESM only).
 */
module.exports = {
  rootDir: '..',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  testMatch: ['<rootDir>/test/e2e/**/*.e2e-spec.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { tsconfig: '<rootDir>/test/tsconfig.jest.json', useESM: true },
    ],
  },
  setupFiles: ['<rootDir>/test/e2e-env.ts'],
  globalSetup: '<rootDir>/test/global-setup.mjs',
  globalTeardown: '<rootDir>/test/global-teardown.mjs',
  testTimeout: 120_000,
};
