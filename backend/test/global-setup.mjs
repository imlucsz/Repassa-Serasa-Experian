// Jest globalSetup (plain ESM — loaded outside the ts-jest transform).
// Uses TEST_DATABASE_URL/DATABASE_URL when provided (CI postgres:16), otherwise
// boots an embedded disposable Postgres 16 daemon, then applies migrations.
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BACKEND_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATE_FILE = join(BACKEND_DIR, 'test', '.e2e-state.json');

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

function waitForReady(child) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('pg daemon timed out')), 120_000);
    let buffer = '';
    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      const line = buffer.split('\n').find((l) => l.startsWith('READY '));
      if (line) {
        clearTimeout(timeout);
        resolve(line.slice(6).trim());
      }
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (!buffer.includes('READY ')) {
        clearTimeout(timeout);
        reject(new Error(`pg daemon exited early (${code}): ${buffer}`));
      }
    });
  });
}

export default async function globalSetup() {
  process.env.NODE_ENV = 'test';
  let url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  let daemonPid = null;

  if (!url) {
    const port = await freePort();
    const child = spawn(
      process.execPath,
      [join(BACKEND_DIR, 'test', 'helpers', 'pg-daemon.mjs'), String(port)],
      { stdio: ['ignore', 'pipe', 'inherit'] },
    );
    url = await waitForReady(child);
    daemonPid = child.pid;
    child.stdout.destroy(); // daemon writes nothing after READY; free the pipe handle
    child.unref();
  }

  process.env.DATABASE_URL = url;
  execFileSync(
    process.execPath,
    [join(BACKEND_DIR, 'node_modules', 'prisma', 'build', 'index.js'), 'migrate', 'deploy'],
    { cwd: BACKEND_DIR, env: { ...process.env, DATABASE_URL: url }, stdio: 'inherit' },
  );
  writeFileSync(STATE_FILE, JSON.stringify({ url, daemonPid }), 'utf8');
}
