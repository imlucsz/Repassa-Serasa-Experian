import { randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import type { EnvConfig } from '../config/env.validation';
import { TokenService } from './token.service';

export const INVALID_SESSION_MESSAGE = 'Session is no longer valid';

export interface RotatedSession {
  userId: string;
  familyId: string;
  token: string;
}

interface LockedSessionRow {
  id: string;
  userId: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

type RotationOutcome =
  | { outcome: 'invalid' | 'reuse' | 'expired' }
  | { outcome: 'rotated'; userId: string; familyId: string; token: string };

@Injectable()
export class SessionService {
  private readonly refreshTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    config: ConfigService<EnvConfig, true>,
  ) {
    this.refreshTtlMs = config.get('refreshTokenTtlDays', { infer: true }) * 86_400_000;
  }

  /** Opens a new session family (register/login). Returns the raw refresh token. */
  async createSession(
    userId: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<string> {
    const token = this.tokens.generateRefreshToken();
    await db.refreshSession.create({
      data: {
        userId,
        familyId: randomUUID(),
        tokenHash: this.tokens.hashRefreshToken(token),
        expiresAt: new Date(Date.now() + this.refreshTtlMs),
      },
    });
    return token;
  }

  /**
   * Atomically rotates a refresh token (SECURITY.md session model).
   *
   * The session row is locked `FOR UPDATE` inside one transaction, so
   * concurrent refreshes of the same token serialize and exactly one wins.
   * Re-presenting an already rotated/revoked token is treated as replay: the
   * whole family is revoked and an audit event is written — both in the same
   * transaction, so revocation and detection commit atomically. Legitimate
   * clients must single-flight refreshes; a concurrent second use forces
   * re-login, which is the documented safe behavior on possible token theft.
   */
  async rotateSession(rawToken: string): Promise<RotatedSession> {
    const hash = this.tokens.hashRefreshToken(rawToken);
    const now = new Date();

    const result = await this.prisma.$transaction<RotationOutcome>(async (tx) => {
      const candidate = await tx.refreshSession.findUnique({
        where: { tokenHash: hash },
        select: { userId: true },
      });
      if (!candidate) return { outcome: 'invalid' };

      // Session creation takes a PostgreSQL key-share lock on the referenced
      // user. Lock user before session here as well so rotation cannot deadlock
      // with login/admin reset paths that lock the user before sessions.
      const userRows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
          FROM "users"
         WHERE id = ${candidate.userId}::uuid
         FOR UPDATE`;
      if (!userRows[0]) return { outcome: 'invalid' };

      const rows = await tx.$queryRaw<LockedSessionRow[]>`
        SELECT id,
               user_id AS "userId",
               family_id AS "familyId",
               expires_at AS "expiresAt",
               revoked_at AS "revokedAt"
        FROM refresh_sessions
        WHERE token_hash = ${hash}
        FOR UPDATE`;
      const session = rows[0];
      if (!session) return { outcome: 'invalid' };

      if (session.revokedAt !== null) {
        await this.revokeFamilyTx(tx, session.familyId);
        await tx.auditEvent.create({
          data: { actorId: session.userId, action: 'auth.refresh_reuse' },
        });
        return { outcome: 'reuse' };
      }

      if (session.expiresAt.getTime() <= now.getTime()) {
        await tx.refreshSession.update({ where: { id: session.id }, data: { revokedAt: now } });
        return { outcome: 'expired' };
      }

      const token = this.tokens.generateRefreshToken();
      const replacement = await tx.refreshSession.create({
        data: {
          userId: session.userId,
          familyId: session.familyId,
          tokenHash: this.tokens.hashRefreshToken(token),
          expiresAt: new Date(now.getTime() + this.refreshTtlMs),
        },
      });
      await tx.refreshSession.update({
        where: { id: session.id },
        data: { revokedAt: now, replacedBy: replacement.id },
      });
      return { outcome: 'rotated', userId: session.userId, familyId: session.familyId, token };
    });

    if (result.outcome !== 'rotated') {
      throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    }
    return { userId: result.userId, familyId: result.familyId, token: result.token };
  }

  /**
   * Revokes the family owning `rawToken` (logout). Returns the owning session's
   * user/family for audit, or undefined when the token is unknown. Idempotent.
   */
  async revokeByToken(
    rawToken: string,
  ): Promise<{ userId: string; familyId: string } | undefined> {
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash: this.tokens.hashRefreshToken(rawToken) },
      select: { userId: true, familyId: true },
    });
    if (!session) return undefined;
    await this.revokeFamily(session.familyId);
    return session;
  }

  /** Revokes every unrevoked session of a family (disabled user, logout, replay). */
  async revokeFamily(familyId: string): Promise<void> {
    await this.revokeFamilyTx(this.prisma, familyId);
  }

  private async revokeFamilyTx(
    tx: Prisma.TransactionClient,
    familyId: string,
  ): Promise<void> {
    await tx.refreshSession.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
