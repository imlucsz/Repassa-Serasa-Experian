// Disposable PostgreSQL daemon for tests/dev without Docker.
// Boots an embedded Postgres 16 cluster (bundled binaries, no download),
// prints `READY <databaseUrl>` on stdout and stays alive until terminated.
// Usage: node test/helpers/pg-daemon.mjs <port> [databaseDir]
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const port = Number(process.argv[2]);
const databaseDir = process.argv[3] ?? mkdtempSync(join(tmpdir(), 'repassa-pg-'));

const pg = new EmbeddedPostgres({
  databaseDir,
  port,
  user: 'postgres',
  password: 'postgres',
  persistent: false,
  onLog: () => {},
  onError: (message) => console.error('[pg]', String(message).trim()),
});

await pg.initialise();
await pg.start();
await pg.createDatabase('repassa_test');

const url = `postgresql://postgres:postgres@127.0.0.1:${port}/repassa_test`;
console.log(`READY ${url}`);

async function shutdown() {
  try {
    await pg.stop();
  } finally {
    process.exit(0);
  }
}
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
