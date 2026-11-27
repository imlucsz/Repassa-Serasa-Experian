import { defineConfig } from '@playwright/test';

const modes = [
  { name: 'demo', port: 4271, mode: 'mock' },
  { name: 'api', port: 4272, mode: 'api' },
];

export default defineConfig({
  testDir: './tests/browser',
  workers: 2,
  use: { channel: process.env.PLAYWRIGHT_CHANNEL, locale: 'pt-BR' },
  projects: modes.map(({ name, port }) => ({
    name,
    testMatch:
      name === 'api'
        ? [
            'api.spec.mjs',
            'institution.spec.mjs',
            'student.spec.mjs',
            'donations.spec.mjs',
            'my-reservations.spec.mjs',
            'pickups.spec.mjs',
            'admin.spec.mjs',
            'admin-a11y.spec.mjs',
          ]
        : ['demo.spec.mjs', 'cinematic-home.spec.mjs'],
    use: { baseURL: 'http://127.0.0.1:' + port },
  })),
  webServer: modes.map(({ port, mode }) => ({
    command:
      'node node_modules/vite/bin/vite.js --host 127.0.0.1 --strictPort --port ' +
      port,
    url: 'http://127.0.0.1:' + port,
    env: { VITE_DATA_MODE: mode },
  })),
});
