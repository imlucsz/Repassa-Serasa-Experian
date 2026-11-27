/**
 * reset-password.ts — out-of-band password reset for an existing account.
 *
 * Usage:
 *   DATABASE_URL="postgres://..." npx tsx scripts/reset-password.ts
 *   DATABASE_URL="postgres://..." npx tsx scripts/reset-password.ts --email user@example.com
 *
 * Safety properties:
 *  - Interactive email confirmation plus hidden password entry and confirmation.
 *  - Remote database targets require typing REDEFINIR before any mutation.
 *  - Uses the backend's Argon2id hashPassword implementation.
 *  - Updates only passwordHash; id, role, memberships, profile and history stay intact.
 *  - Revokes every live refresh session in the same transaction and verifies zero remain.
 *  - Writes an admin.password_reset audit event; never prints passwords, hashes,
 *    tokens or database credentials.
 */
import { createInterface } from 'node:readline';
import { PrismaClient } from '@prisma/client';
import {
  normalizePasswordResetEmail,
  resetUserPassword,
  validatePasswordResetSecret,
} from '../src/auth/password-reset';

const prisma = new PrismaClient();

function usage(): string {
  return 'Usage: DATABASE_URL="postgres://..." npx tsx scripts/reset-password.ts [--email user@example.com]';
}

function parseArgs(): { email?: string; help: boolean } {
  const argv = process.argv.slice(2);
  let email: string | undefined;
  let help = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      help = true;
      continue;
    }
    if (arg === '--email') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new Error('--email requires a value');
      email = value;
      i++;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return { email, help };
}

function prompt(query: string, hidden = false): Promise<string> {
  if (hidden && !process.stdin.isTTY) {
    throw new Error('An interactive terminal is required for hidden password input');
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (!hidden) {
    return new Promise((resolve) =>
      rl.question(query, (answer) => {
        rl.close();
        resolve(answer);
      }),
    );
  }

  // Hide the secret completely: unlike a masked prompt, not even the password
  // length is exposed. `_writeToOutput` is the documented readline workaround
  // used for terminal password entry; the initial prompt is still printed.
  const muted = { value: true };
  let promptWritten = false;
  const rlHidden = rl as unknown as {
    _writeToOutput: (s: string) => void;
    output: NodeJS.WritableStream;
  };
  rlHidden._writeToOutput = function (s: string) {
    if (!muted.value) {
      this.output.write(s);
    } else if (!promptWritten && s.startsWith(query)) {
      promptWritten = true;
      this.output.write(s);
    }
  };
  return new Promise((resolve) =>
    rl.question(query, (answer) => {
      muted.value = false;
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    }),
  );
}

function databaseHostname(databaseUrl: string): string | undefined {
  try {
    return new URL(databaseUrl).hostname.replace(/^\[|\]$/g, '').toLowerCase();
  } catch {
    return undefined;
  }
}

function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

async function confirmRemoteTarget(databaseUrl: string): Promise<void> {
  const hostname = databaseHostname(databaseUrl);
  if (!hostname) throw new Error('DATABASE_URL is not a valid PostgreSQL URL');
  if (isLocalHostname(hostname)) return;
  console.log(`Remote database target detected (${hostname}). Credentials will not be printed.`);
  const ack = await prompt('Type REDEFINIR to confirm this remote target: ');
  if (ack !== 'REDEFINIR') {
    throw new Error('Remote reset was not confirmed; aborted before any mutation');
  }
}

function redactSecrets(message: string): string {
  let safe = message;
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) safe = safe.split(databaseUrl).join('[redacted-database-url]');
  return safe.replace(/(postgres(?:ql)?:\/\/)[^\s/@]+(?::[^\s/@]*)?@/giu, '$1[redacted]@');
}

async function main(): Promise<void> {
  const args = parseArgs();
  if (args.help) {
    console.log(usage());
    return;
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required — point it at the target database.');
  }
  if (!process.stdin.isTTY) {
    throw new Error('An interactive terminal is required; do not pipe the password or confirmations');
  }

  await confirmRemoteTarget(databaseUrl);

  const typedEmail = args.email ?? (await prompt('Account email: '));
  const email = normalizePasswordResetEmail(typedEmail);
  const confirmedEmail = normalizePasswordResetEmail(await prompt('Confirm account email: '));
  if (email !== confirmedEmail) {
    throw new Error('Email confirmation does not match; aborted before any mutation');
  }

  const password = await prompt('New password (hidden): ', true);
  const confirmation = await prompt('Repeat new password (hidden): ', true);
  if (password !== confirmation) {
    throw new Error('Passwords do not match; aborted before any mutation');
  }
  validatePasswordResetSecret(password);

  const result = await resetUserPassword(prisma, { email, password });
  console.log(`Password reset completed for ${result.email}.`);
  console.log(
    `Refresh sessions revoked: ${result.sessionsRevoked}; unrevoked sessions verified: ${result.unrevokedSessions}.`,
  );
  console.log(`Audit event recorded: ${result.auditEventId}`);
  console.log(
    'With the credential-check API revision deployed, access tokens issued before the reset are invalid immediately; older API revisions only retain them until normal expiry.',
  );
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(redactSecrets(message));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
