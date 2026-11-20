/**
 * Argon2id password hashing — single source of truth shared by the auth
 * service and the seed. Parameters follow OWASP minimums documented in
 * docs/repassa/SECURITY.md (19 MiB memory, 2 iterations, parallelism 1).
 * Raw passwords and hashes must never appear in logs or responses.
 */
import * as argon2 from 'argon2';

export const ARGON2_OPTIONS: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

/** Constant-work verification for unknown accounts (enumeration mitigation). */
let dummyHashPromise: Promise<string> | undefined;

function getDummyHash(): Promise<string> {
  dummyHashPromise ??= argon2.hash('repassa-constant-work-placeholder', ARGON2_OPTIONS);
  return dummyHashPromise;
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false; // malformed stored hash — treat as failed, never throw internals
  }
}

/**
 * Runs an Argon2 verify against a stable dummy hash so that login attempts on
 * non-existent accounts cost the same work as real verifications.
 */
export async function verifyAgainstDummyHash(password: string): Promise<void> {
  await verifyPassword(await getDummyHash(), password);
}
