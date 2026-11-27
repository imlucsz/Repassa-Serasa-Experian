import type { PrismaClient } from '@prisma/client';
import { hashPassword } from '../common/crypto/password';

const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export interface ResetUserPasswordInput {
  email: string;
  password: string;
}

export interface ResetUserPasswordResult {
  userId: string;
  email: string;
  sessionsRevoked: number;
  unrevokedSessions: number;
  auditEventId: string;
}

/** Lowercased, trimmed — matches the normalized unique users.email column. */
export function normalizePasswordResetEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validatePasswordResetSecret(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    throw new Error('Password must be 12-128 characters');
  }
}

/**
 * Out-of-band administrative password reset used by backend/scripts/reset-password.ts.
 *
 * The user row is locked FOR UPDATE so this operation serializes with login's
 * credential verification/session creation. Only passwordHash changes: role,
 * memberships, profile data, reservations and materials are untouched. Every
 * live refresh session is revoked in the same transaction, the zero-unrevoked
 * invariant is verified before commit, and the audit row never contains the
 * password or hash.
 */
export async function resetUserPassword(
  prisma: PrismaClient,
  input: ResetUserPasswordInput,
): Promise<ResetUserPasswordResult> {
  const email = normalizePasswordResetEmail(input.email);
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    throw new Error('Invalid email');
  }
  validatePasswordResetSecret(input.password);

  const passwordHash = await hashPassword(input.password);
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string; email: string }>>`
      SELECT id, email
        FROM "users"
       WHERE email = ${email}
       FOR UPDATE`;
    const user = rows[0];
    if (!user) throw new Error('Account not found');

    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    const revokedAt = new Date();
    const revoked = await tx.refreshSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt },
    });
    const unrevokedSessions = await tx.refreshSession.count({
      where: { userId: user.id, revokedAt: null },
    });
    if (unrevokedSessions !== 0) {
      throw new Error('Failed to revoke all existing sessions');
    }

    const audit = await tx.auditEvent.create({
      data: {
        action: 'admin.password_reset',
        metadata: {
          targetUserId: user.id,
          sessionsRevoked: revoked.count,
          unrevokedSessions,
          source: 'backend/scripts/reset-password.ts',
        },
      },
      select: { id: true },
    });

    return {
      userId: user.id,
      email: user.email,
      sessionsRevoked: revoked.count,
      unrevokedSessions,
      auditEventId: audit.id,
    };
  });
}
