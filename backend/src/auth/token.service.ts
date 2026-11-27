import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
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
  /** Keyed fingerprint of the password hash current when the token was issued. */
  credentialVersion: string;
}

const PASSWORD_CREDENTIAL_CLAIM = 'pcv';
const PASSWORD_CREDENTIAL_DOMAIN = 'repassa-password-credential-v1\0';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly key: Uint8Array;
  private readonly credentialKey: Uint8Array;

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
    this.credentialKey = createHmac('sha256', this.key)
      .update('repassa-credential-hmac-key-v1')
      .digest();
  }

  /** Signs a short-lived HS256 access token. `ttlSeconds` may be negative for tests. */
  async signAccessToken(
    user: { id: string; role: string; passwordHash: string },
    ttlSeconds: number,
  ): Promise<string> {
    return new SignJWT({
      role: user.role,
      [PASSWORD_CREDENTIAL_CLAIM]: this.passwordCredentialVersion(user.passwordHash),
    })
      .setProtectedHeader({ alg: ALGORITHM, typ: 'JWT' })
      .setSubject(user.id)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
      .sign(this.key);
  }

  /** Verifies signature, algorithm pin, issuer, audience, expiry and required claims. */
  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: [ALGORITHM],
        issuer: ISSUER,
        audience: AUDIENCE,
      });
      const credentialVersion = payload[PASSWORD_CREDENTIAL_CLAIM];
      if (
        typeof payload.sub !== 'string' ||
        typeof payload.role !== 'string' ||
        typeof credentialVersion !== 'string'
      ) {
        throw new InvalidAccessTokenError('missing claims');
      }
      return { sub: payload.sub, role: payload.role, credentialVersion };
    } catch (error) {
      if (error instanceof InvalidAccessTokenError) throw error;
      throw new InvalidAccessTokenError('invalid token');
    }
  }

  /**
   * Compares the token credential fingerprint with the user's current password
   * hash. The fingerprint is an HMAC keyed by the server-only JWT secret, so the
   * visible JWT claim is neither the password hash nor an offline password verifier.
   */
  matchesPasswordCredential(credentialVersion: string, passwordHash: string): boolean {
    const expected = Buffer.from(this.passwordCredentialVersion(passwordHash), 'utf8');
    const actual = Buffer.from(credentialVersion, 'utf8');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  private passwordCredentialVersion(passwordHash: string): string {
    return createHmac('sha256', this.credentialKey)
      .update(PASSWORD_CREDENTIAL_DOMAIN)
      .update(passwordHash, 'utf8')
      .digest('base64url');
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
