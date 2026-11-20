/**
 * Unit tests — pure Node, no database required.
 * @nestjs/* is ESM-only, so tests run in Jest ESM mode:
 * `node --experimental-vm-modules node_modules/jest/bin/jest.js ...`
 */
module.exports = {
  rootDir: '..',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  testMatch: ['<rootDir>/test/unit/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { tsconfig: '<rootDir>/test/tsconfig.jest.json', useESM: true },
    ],
  },
  setupFiles: ['<rootDir>/test/unit-env.ts'],
  clearMocks: true,
};
