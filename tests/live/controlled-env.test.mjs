import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizedInheritedEnv } from './controlled-env.mjs';

const databaseUrlKey = 'DATABASE_URL';

test('controlled launcher environment strips inherited production application configuration', () => {
  const env = sanitizedInheritedEnv({
    PATH: '/safe-path',
    [databaseUrlKey]: 'postgresql://u:p@db.example.com/repassa',
    TEST_DATABASE_URL: 'postgresql://u:p@db.example.com/repassa',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'fake',
    STORAGE_DRIVER: 'supabase',
    JWT_ACCESS_SECRET: 'fake',
    REPASSA_API_TARGET: 'https://repassa-serasa-experian.onrender.com',
    JOURNEY_DB_URL: 'postgresql://u:p@db.example.com/repassa',
    VITE_DATA_MODE: 'mock',
    PGHOST: 'db.example.com',
  });
  assert.equal(env.PATH, '/safe-path');
  for (const key of [
    'DATABASE_URL',
    'TEST_DATABASE_URL',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'STORAGE_DRIVER',
    'JWT_ACCESS_SECRET',
    'REPASSA_API_TARGET',
    'JOURNEY_DB_URL',
    'VITE_DATA_MODE',
    'PGHOST',
  ]) assert.equal(env[key], undefined, key);
});
