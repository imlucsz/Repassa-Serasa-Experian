// Jest globalTeardown — stops the disposable Postgres daemon if one was started.
import { readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const STATE_FILE = join(dirname(fileURLToPath(import.meta.url)), '.e2e-state.json');

export default async function globalTeardown() {
  try {
    const { daemonPid } = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
    if (daemonPid) {
      try {
        process.kill(daemonPid);
      } catch {
        /* already stopped */
      }
    }
  } catch {
    /* no state file — nothing to stop */
  }
  rmSync(STATE_FILE, { force: true });
}
