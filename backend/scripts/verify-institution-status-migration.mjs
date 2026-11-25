// Upgrade-path proof for migration 20261124230000_institution_approval_status:
// boots a disposable embedded Postgres 16, applies ONLY the init migration,
// seeds pre-workflow institutions, applies the approval migration, then asserts
// the backfill (existing rows → APPROVED) and the new default (new rows →
// PENDING). Usage: node scripts/verify-institution-status-migration.mjs
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const BACKEND_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS = join(BACKEND_DIR, 'prisma', 'migrations');

const freePort = () =>
  new Promise((resolve, reject) => {
    const s = createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

const port = await freePort();
const daemon = spawn(process.execPath, [join(BACKEND_DIR, 'test', 'helpers', 'pg-daemon.mjs'), String(port)], {
  stdio: ['ignore', 'pipe', 'inherit'],
});
const url = await new Promise((resolve, reject) => {
  let buf = '';
  const t = setTimeout(() => reject(new Error('pg daemon timed out')), 120_000);
  daemon.stdout.on('data', (c) => {
    buf += c.toString();
    const line = buf.split('\n').find((l) => l.startsWith('READY '));
    if (line) { clearTimeout(t); resolve(line.slice(6).trim()); }
  });
  daemon.once('exit', (code) => reject(new Error(`pg daemon exited ${code}`)));
});
daemon.stdout.destroy();

const prismaDbExecute = (file) =>
  execFileSync(
    process.execPath,
    [join(BACKEND_DIR, 'node_modules', 'prisma', 'build', 'index.js'), 'db', 'execute', '--file', file, '--url', url],
    { cwd: BACKEND_DIR, stdio: 'inherit' },
  );

try {
  // 1) Pre-migration state: init schema only, with live institutions.
  prismaDbExecute(join(MIGRATIONS, '20261120014024_init', 'migration.sql'));

  const legacySql = join(tmpdir(), 'repassa-legacy-rows.sql');
  writeFileSync(
    legacySql,
    `INSERT INTO "users" (id, email, display_name, password_hash, role, is_active, updated_at)
       VALUES (gen_random_uuid(), 'dono@t.dev', 'Dono', 'x', 'STUDENT', true, CURRENT_TIMESTAMP);
     INSERT INTO "institutions" (id, name, public_address, pickup_instructions, is_active, updated_at)
       VALUES (gen_random_uuid(), 'Instituto Antigo A', 'Rua A, 1', 'Balcão', true, CURRENT_TIMESTAMP),
              (gen_random_uuid(), 'Instituto Antigo B', 'Rua B, 2', 'Balcão', true, CURRENT_TIMESTAMP),
              (gen_random_uuid(), 'Instituto Inativo C', 'Rua C, 3', 'Balcão', false, CURRENT_TIMESTAMP);`,
  );
  prismaDbExecute(legacySql);

  // 2) Apply the approval-workflow migration on top of existing rows.
  prismaDbExecute(join(MIGRATIONS, '20261124230000_institution_approval_status', 'migration.sql'));

  // 3) Assertions via raw SQL (schema may differ from generated client here).
  const prisma = new PrismaClient({ datasourceUrl: url });
  const rows = await prisma.$queryRawUnsafe(
    `SELECT name, status::text AS status, is_active AS "isActive" FROM "institutions" ORDER BY name`,
  );
  for (const r of rows) {
    if (r.status !== 'APPROVED') throw new Error(`Backfill failed: ${r.name} is ${r.status}`);
  }
  console.log(`PASS backfill: ${rows.length} pre-existing institutions → APPROVED`);

  const fresh = await prisma.$queryRawUnsafe(
    `INSERT INTO "institutions" (id, name, public_address, pickup_instructions, is_active, updated_at)
       VALUES (gen_random_uuid(), 'Instituto Novo', 'Rua N, 9', 'Portaria', true, CURRENT_TIMESTAMP)
       RETURNING status::text AS status`,
  );
  if (fresh[0].status !== 'PENDING') throw new Error(`Default failed: new row is ${fresh[0].status}`);
  console.log('PASS default: new registrations without explicit status → PENDING');
  await prisma.$disconnect();
} finally {
  daemon.kill('SIGINT');
}
console.log('MIGRATION UPGRADE VERIFIED');
