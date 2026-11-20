import {
  ARGON2_OPTIONS,
  hashPassword,
  verifyAgainstDummyHash,
  verifyPassword,
} from '../../src/common/crypto/password';
import * as argon2 from 'argon2';

describe('password hashing (argon2id)', () => {
  it('uses argon2id with the documented OWASP parameters', () => {
    expect(ARGON2_OPTIONS).toEqual({
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
  });

  it('hashes and verifies a password, rejects a wrong one', async () => {
    const hash = await hashPassword('correct-horse-battery');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain('correct-horse');
    await expect(verifyPassword(hash, 'correct-horse-battery')).resolves.toBe(true);
    await expect(verifyPassword(hash, 'wrong-password')).resolves.toBe(false);
  });

  it('rejects malformed stored hashes instead of throwing', async () => {
    await expect(verifyPassword('not-a-real-hash', 'whatever')).resolves.toBe(false);
  });

  it('performs constant-work verification against the dummy hash', async () => {
    // Unknown-account login path: must cost a real argon2 verify, never throw.
    await expect(verifyAgainstDummyHash('any-password-123')).resolves.toBeUndefined();
  });
});
