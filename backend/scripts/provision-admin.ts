/**
 * provision-admin.ts — out-of-band provisioning of an ADMIN account.
 *
 * The API can never grant ADMIN (admin.user_role is bounded STUDENT↔STAFF),
 * so the first administrator is created here, by someone who already has
 * database access. This is NOT a public endpoint and NOT part of the demo seed.
 *
 * Usage:
 *   DATABASE_URL="postgres://..." npx tsx scripts/provision-admin.ts
 *   npx tsx scripts/provision-admin.ts --generate        # random 20-char password, printed once
 *   npx tsx scripts/provision-admin.ts --email a@b.br --elevate
 *
 * Safety properties:
 *  - No fixed/demo password: interactive hidden prompt or crypto-random.
 *  - Elevation of an existing account requires --elevate (explicit, audited).
 *  - Writes an audit_events row (action 'admin.provision') for accountability.
 *  - Never logs the password or hash.
 */
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/common/crypto/password';

const args = new Set(process.argv.slice(2));
const argValue = (flag: string): string | undefined => {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
};

const prisma = new PrismaClient();

function prompt(query: string, hidden = false): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    // Mute echo: mask every typed character (canonical readline trick).
    const muted = { value: true };
    const rlMuted = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WritableStream };
    rlMuted._writeToOutput = function (s: string) {
      if (muted.value && !s.startsWith(query)) this.output.write('*');
      else this.output.write(s);
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
  return new Promise((resolve) => rl.question(query, (a) => { rl.close(); resolve(a); }));
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required — point it at the target database.');
  }

  const elevate = args.has('--elevate');
  const email = (argValue('--email') ?? (await prompt('Admin email: '))).trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) {
    throw new Error('Invalid email');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  let password: string | undefined;

  if (existing) {
    if (!elevate) {
      throw new Error(`User ${email} already exists — pass --elevate to grant ADMIN.`);
    }
    if (existing.role === 'ADMIN') {
      console.log(`${email} is already ADMIN. Nothing to do.`);
      return;
    }
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: existing.id }, data: { role: 'ADMIN' } });
      await tx.refreshSession.updateMany({ where: { userId: existing.id }, data: { revokedAt: new Date() } });
      await tx.auditEvent.create({
        data: { action: 'admin.provision', metadata: { email, mode: 'elevate', previousRole: existing.role } },
      });
    });
    console.log(`${email} elevated to ADMIN (sessions revoked — next login issues admin tokens).`);
    return;
  }

  const displayName = (argValue('--name') ?? (await prompt('Display name: '))).trim();
  if (displayName.length < 2 || displayName.length > 80) {
    throw new Error('Display name must be 2–80 chars');
  }

  if (args.has('--generate')) {
    password = randomBytes(15).toString('base64url'); // 20 chars, printed once below
  } else {
    password = await prompt('Password (min 12 chars, hidden): ', true);
    const again = await prompt('Repeat password: ', true);
    if (password !== again) throw new Error('Passwords do not match');
  }
  if (password.length < 12 || password.length > 128) {
    throw new Error('Password must be 12–128 chars');
  }

  await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        displayName,
        passwordHash: await hashPassword(password),
        role: 'ADMIN',
        isActive: true,
      },
    });
    await tx.auditEvent.create({
      data: { action: 'admin.provision', metadata: { email, mode: 'create', userId: created.id } },
    });
  });

  console.log(`ADMIN account created for ${email}.`);
  if (args.has('--generate')) {
    console.log(`One-time generated password (store it now, it is never shown again): ${password}`);
  }
}

main()
  .catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
