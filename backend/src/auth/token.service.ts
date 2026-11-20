import { createHash, randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SignJWT, jwtVerify } from 'jose';
import type { EnvConfig } from '../config/env.validation';

const ISSUER = 'repassa-api';
const AUDIENCE = 'repassa-web';
const ALGORITHM = 'HS256';

export class InvalidAccessTokenError extends Error {}

export interface AccessTokenClaims {
  sub: string;
  role: string;
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly key: Uint8Array;

  constructor(config: ConfigService<EnvConfig, true>) {
    const secret = config.get('jwtAccessSecret', { infer: true });
    if (secret) {
      this.key = new TextEncoder().encode(secret);
    } else {
      // Development/test only — env validation makes the secret required in
      // production, so this branch can never run there. Ephemeral per-process
      // key: active access tokens are invalidated on restart.
      this.key = randomBytes(32);
      this.logger.warn(
        'JWT_ACCESS_SECRET not set; using an ephemeral per-process signing key (dev/test only).',
      );
    }
  }

  /** Signs a short-lived HS256 access token. `ttlSeconds` may be negative for tests. */
  async signAccessToken(user: { id: string; role: string }, ttlSeconds: number): Promise<string> {
    return new SignJWT({ role: user.role })
      .setProtectedHeader({ alg: ALGORITHM, typ: 'JWT' })
      .setSubject(user.id)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
      .sign(this.key);
  }

  /** Verifies signature, algorithm pin, issuer, audience and expiry. */
  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: [ALGORITHM],
        issuer: ISSUER,
        audience: AUDIENCE,
      });
      if (typeof payload.sub !== 'string' || typeof payload.role !== 'string') {
        throw new InvalidAccessTokenError('missing claims');
      }
      return { sub: payload.sub, role: payload.role };
    } catch (error) {
      if (error instanceof InvalidAccessTokenError) throw error;
      throw new InvalidAccessTokenError('invalid token');
    }
  }

  /** 256-bit cryptographically random opaque refresh token. */
  generateRefreshToken(): string {
    return randomBytes(32).toString('base64url');
  }

  /** Token digest stored at rest — the raw value never persists. */
  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }
}
