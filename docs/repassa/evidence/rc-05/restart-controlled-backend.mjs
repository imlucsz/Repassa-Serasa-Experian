// Restart only the backend of the controlled disposable stack, preserving its
// loopback database, upload directory, ports and sanitized application env.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const repoRoot = process.cwd();
const { sanitizedInheritedEnv } = await import(pathToFileURL(resolve(repoRoot, 'tests/live/controlled-env.mjs')).href);
const manifestPath = process.argv[2];
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const apiOrigin = new URL(manifest.api).origin;
const port = new URL(manifest.api).port || '80';
const oldPid = manifest.processes.backend;

try { process.kill(oldPid); } catch {}
for (let i = 0; i < 40; i++) {
  const alive = await fetch(apiOrigin + '/api/v1/health', { redirect: 'manual' }).then((r) => r.ok).catch(() => false);
  if (!alive) break;
  await new Promise((r) => setTimeout(r, 250));
}

const accessSecret = randomBytes(32).toString('hex');
const pickupSecret = randomBytes(32).toString('hex');
const env = {
  ...sanitizedInheritedEnv(),
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: String(port),
  DATABASE_URL: manifest.dbUrl,
  ALLOWED_ORIGINS: manifest.base,
  TRUST_PROXY: 'false',
  SWAGGER_ENABLED: 'false',
  LOG_LEVEL: 'error',
  COOKIE_SECURE: 'false',
  STORAGE_DRIVER: 'local',
  UPLOAD_DIR: manifest.uploadDir,
  JWT_ACCESS_SECRET: accessSecret,
  PICKUP_CODE_SECRET: pickupSecret,
};
const child = spawn(process.execPath, [resolve(repoRoot, 'backend/dist/main.js')], {
  cwd: resolve(repoRoot, 'backend'), env, detached: true, stdio: 'ignore', windowsHide: true,
});
child.unref();
let ready = false;
for (let i = 0; i < 120; i++) {
  ready = await fetch(apiOrigin + '/api/v1/health', { redirect: 'manual' }).then((r) => r.ok).catch(() => false);
  if (ready) break;
  await new Promise((r) => setTimeout(r, 250));
}
if (!ready) throw new Error('restarted backend did not become healthy');
await writeFile(manifestPath + '.restarted-backend.pid', String(child.pid));
console.log('backend restarted: oldPid=' + oldPid + ' newPid=' + child.pid + ' health=200');
