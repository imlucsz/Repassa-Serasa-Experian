// Controlled disposable SH-02 stack launcher. This launcher is intentionally
// process-continuous: it starts PostgreSQL, backend and Vite itself, verifies
// their wiring, and writes a manifest that both mutating harnesses require.
// It never uses inherited application secrets or production-shaped endpoints.
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBackendPrisma } from './backend-prisma.mjs';
import { sanitizedInheritedEnv } from './controlled-env.mjs';
import { CONTROLLED_STACK_KIND } from './harness-guard.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const backendDir = join(repoRoot, 'backend');

function argValue(flag, fallback) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function portValue(flag, fallback) {
  const value = Number(argValue(flag, fallback));
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`${flag} must be an integer between 1 and 65535`);
  }
  return value;
}

const pgPort = portValue('--pg-port', 55434);
const apiPort = portValue('--api-port', 3001);
const frontendPort = portValue('--frontend-port', 4272);
const adminEmail = argValue('--admin-email', 'admin-jornada@example.com').trim().toLowerCase();
const adminName = argValue('--admin-name', 'Admin Jornada');

const apiOrigin = `http://127.0.0.1:${apiPort}`;
const api = `${apiOrigin}/api/v1`;
const base = `http://127.0.0.1:${frontendPort}`;
const root = mkdtempSync(join(tmpdir(), 'repassa-stack-'));
const uploadDir = join(root, 'uploads');
const pgDir = join(root, 'pg');
const manifestPath = join(root, 'stack-manifest.json');
mkdirSync(uploadDir, { recursive: true });

const baseEnv = sanitizedInheritedEnv();
const children = [];
let shuttingDown = false;

function appendOutput(child, chunk) {
  child.combinedOutput = ((child.combinedOutput ?? '') + chunk.toString()).slice(-5000);
}

function spawnChild(name, command, args, options) {
  const child = spawn(command, args, {
    ...options,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.harnessName = name;
  child.stdout.on('data', (chunk) => appendOutput(child, chunk));
  child.stderr.on('data', (chunk) => appendOutput(child, chunk));
  children.push(child);
  return child;
}

function runStep(command, args, { cwd, env, label }) {
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    throw new Error(
      `${label} failed (${result.error?.message ?? 'exit ' + result.status})\n` +
        `${result.stdout ?? ''}${result.stderr ?? ''}`.slice(-4000),
    );
  }
  return result;
}

function waitForOutput(child, pattern, label, timeoutMs = 45_000) {
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`${label} did not become ready in time\n${output}`));
    }, timeoutMs);
    function done(match) {
      cleanup();
      resolve(match);
    }
    function cleanup() {
      clearTimeout(timer);
      child.stdout.off('data', onData);
      child.off('exit', onExit);
    }
    function onData(chunk) {
      output += chunk.toString();
      const match = output.match(pattern);
      if (match) done(match);
    }
    function onExit(code) {
      cleanup();
      reject(new Error(`${label} exited with ${code} before readiness\n${output}\n${child.combinedOutput ?? ''}`));
    }
    child.stdout.on('data', onData);
    child.on('exit', onExit);
  });
}

async function waitForHttpOk(url, label, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let last = 'not reached';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status >= 300 && response.status < 400)
        throw new Error(`${label} unexpectedly redirects with HTTP ${response.status}`);
      if (response.ok) return;
      last = `HTTP ${response.status}`;
    } catch (error) {
      if (String(error?.message ?? error).includes('unexpectedly redirects')) throw error;
      last = error?.message ?? String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${label} did not become ready: ${last}`);
}

async function stopChildren() {
  for (const child of [...children].reverse()) {
    if (child.exitCode === null && child.signalCode === null) child.kill();
  }
  await Promise.all(children.map((child) =>
    new Promise((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) return resolve();
      const timer = setTimeout(resolve, 3000);
      child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    }),
  ));
}

async function cleanupAndExit(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  await stopChildren();
  rmSync(root, { recursive: true, force: true });
  process.exit(code);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => void cleanupAndExit(0));
}

async function main() {
  let databaseUrl;
  let backendLoginVerified = false;
  let migrationsApplied = false;
  let proxyHealthVerified = false;
  let environmentNonce;

  const postgres = spawnChild(
    'postgres',
    process.execPath,
    [join(backendDir, 'test/helpers/pg-daemon.mjs'), String(pgPort), pgDir],
    { cwd: backendDir, env: baseEnv },
  );
  const ready = await waitForOutput(postgres, /READY (postgresql:\/\/\S+)/, 'disposable PostgreSQL');
  databaseUrl = ready[1];

  runStep(
    process.execPath,
    [join(backendDir, 'node_modules/@nestjs/cli/bin/nest.js'), 'build'],
    { cwd: backendDir, env: baseEnv, label: 'backend build' },
  );

  const databaseEnv = { ...baseEnv, NODE_ENV: 'development', DATABASE_URL: databaseUrl };
  runStep(
    process.execPath,
    [join(backendDir, 'node_modules/prisma/build/index.js'), 'migrate', 'deploy'],
    { cwd: backendDir, env: databaseEnv, label: 'disposable database migration' },
  );
  migrationsApplied = true;

  const provision = runStep(
    process.execPath,
    [
      join(backendDir, 'node_modules/tsx/dist/cli.mjs'),
      'scripts/provision-admin.ts',
      '--generate',
      '--email',
      adminEmail,
      '--name',
      adminName,
    ],
    { cwd: backendDir, env: databaseEnv, label: 'admin provisioning' },
  );
  const password = provision.stdout.match(/One-time generated password \(store it now, it is never shown again\): (\S+)/)?.[1];
  if (!password) throw new Error('admin provisioning did not produce a one-time password');

  const backendEnv = {
    ...baseEnv,
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: String(apiPort),
    DATABASE_URL: databaseUrl,
    ALLOWED_ORIGINS: base,
    TRUST_PROXY: 'false',
    SWAGGER_ENABLED: 'false',
    LOG_LEVEL: 'error',
    COOKIE_SECURE: 'false',
    STORAGE_DRIVER: 'local',
    UPLOAD_DIR: uploadDir,
  };
  backendEnv.JWT_ACCESS_SECRET = randomBytes(32).toString('hex');
  backendEnv.PICKUP_CODE_SECRET = randomBytes(32).toString('hex');
  const storageProbe = randomBytes(16).toString('hex');
  writeFileSync(join(uploadDir, '.storage-probe'), storageProbe, { flag: 'wx' });
  if (readFileSync(join(uploadDir, '.storage-probe'), 'utf8') !== storageProbe)
    throw new Error('local object-storage probe readback failed');
  rmSync(join(uploadDir, '.storage-probe'), { force: true });

  const backend = spawnChild(
    'backend',
    process.execPath,
    [join(backendDir, 'dist/main.js')],
    { cwd: backendDir, env: backendEnv },
  );
  await waitForHttpOk(api + '/health', 'local backend health');

  const login = await fetch(api + '/auth/login', {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/json', 'X-Repassa-Request': '1' },
    body: JSON.stringify({ email: adminEmail, password }),
  });
  if (login.status >= 300 && login.status < 400)
    throw new Error('backend login unexpectedly redirects');
  if (!login.ok) throw new Error('backend login verification failed with HTTP ' + login.status);
  const proofClient = createBackendPrisma(databaseUrl);
  try {
    const proofRows = await proofClient.$queryRaw`
      SELECT ae.id
      FROM audit_events ae
      JOIN users u ON u.id = ae.actor_id
      WHERE ae.action = 'auth.login'
        AND u.email = ${adminEmail}
      ORDER BY ae.created_at DESC
      LIMIT 1`;
    environmentNonce = proofRows[0]?.id;
  } finally {
    await proofClient.$disconnect();
  }
  if (!environmentNonce)
    throw new Error('backend login did not appear in the disposable database audit log');
  backendLoginVerified = true;

  const frontend = spawnChild(
    'frontend',
    process.execPath,
    [
      join(repoRoot, 'node_modules/vite/bin/vite.js'),
      '--host',
      '127.0.0.1',
      '--strictPort',
      '--port',
      String(frontendPort),
    ],
    {
      cwd: repoRoot,
      env: {
        ...baseEnv,
        VITE_DATA_MODE: 'api',
        REPASSA_API_TARGET: apiOrigin,
      },
    },
  );
  await waitForHttpOk(base + '/', 'local Vite frontend');
  await waitForHttpOk(base + '/api/v1/health', 'local Vite proxy health');
  proxyHealthVerified = true;

  const manifest = {
    kind: CONTROLLED_STACK_KIND,
    version: 1,
    createdAt: new Date().toISOString(),
    base,
    api,
    dbUrl: databaseUrl,
    proxyTarget: apiOrigin,
    storageDriver: 'local',
    uploadDir,
    sanitizedEnvironment: true,
    environmentNonce,
    verification: {
      postgresReady: true,
      migrationsApplied,
      backendLoginVerified,
      objectStorageLocal: true,
      proxyHealthVerified,
    },
    processes: {
      postgres: postgres.pid,
      backend: backend.pid,
      frontend: frontend.pid,
    },
  };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });

  console.log('Controlled disposable RePassa stack is ready.');
  console.log(`Frontend: ${base}`);
  console.log(`API: ${api}`);
  console.log(`Manifest: ${manifestPath}`);
  console.log(`One-time synthetic admin password for ${adminEmail}: ${password}`);
  console.log('Use the password only in this disposable stack. Keep this launcher running; Ctrl+C stops and removes the stack.');
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await cleanupAndExit(1);
});
