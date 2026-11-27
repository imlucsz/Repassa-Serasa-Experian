import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type User } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  hashPassword,
  verifyAgainstDummyHash,
  verifyPassword,
} from '../common/crypto/password';
import { RateLimitService } from '../common/rate-limit/rate-limit.service';
import type { EnvConfig } from '../config/env.validation';
import { INVALID_SESSION_MESSAGE, SessionService } from './session.service';
import { TokenService } from './token.service';
import type { LoginDto, RegisterDto } from './dto/auth.dto';

/**
 * Rate-limit defaults (SECURITY.md proposal). In-memory fixed windows — valid
 * for the single-replica demo deployment; multi-instance needs a shared store.
 */
const MINUTE_MS = 60_000;
const LOGIN_PER_IDENTITY = { limit: 5, windowMs: MINUTE_MS };
const LOGIN_PER_IP = { limit: 30, windowMs: MINUTE_MS };
const REGISTER_PER_IDENTITY = { limit: 5, windowMs: MINUTE_MS };
const REGISTER_PER_IP = { limit: 10, windowMs: MINUTE_MS };
const REFRESH_PER_IP = { limit: 60, windowMs: MINUTE_MS };
const LOGOUT_PER_IP = { limit: 60, windowMs: MINUTE_MS };

/** Identical response for every credential failure — no account enumeration. */
const INVALID_CREDENTIALS = 'Invalid credentials';

export interface IssuedAuth {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly sessions: SessionService,
    private readonly rateLimit: RateLimitService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  /**
   * Public registration — STUDENT only. The role is assigned server-side and
   * the contract DTO rejects any role/membership field, so clients can never
   * self-provision STAFF or ADMIN (staff is seeded/provisioned separately).
   */
  async register(dto: RegisterDto, clientIp: string): Promise<IssuedAuth> {
    const email = normalizeEmail(dto.email);
    this.rateLimit.assertAllowed(`register:id:${clientIp}:${email}`, REGISTER_PER_IDENTITY.limit, REGISTER_PER_IDENTITY.windowMs);
    this.rateLimit.assertAllowed(`register:ip:${clientIp}`, REGISTER_PER_IP.limit, REGISTER_PER_IP.windowMs);

    const passwordHash = await hashPassword(dto.password);
    let registered: { user: User; refreshToken: string };
    try {
      registered = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            displayName: dto.displayName.trim(),
            passwordHash,
            role: 'STUDENT', // server-enforced; never from the request
          },
        });
        await tx.auditEvent.create({
          data: { actorId: user.id, action: 'auth.register' },
        });
        const refreshToken = await this.sessions.createSession(user.id, tx);
        return { user, refreshToken };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email already registered');
      }
      throw error;
    }
    return this.issue(registered.user, registered.refreshToken);
  }

  /** All active roles. Generic failure for unknown/disabled/bad password. */
  async login(dto: LoginDto, clientIp: string): Promise<IssuedAuth> {
    const email = normalizeEmail(dto.email);
    this.rateLimit.assertAllowed(`login:id:${clientIp}:${email}`, LOGIN_PER_IDENTITY.limit, LOGIN_PER_IDENTITY.windowMs);
    this.rateLimit.assertAllowed(`login:ip:${clientIp}`, LOGIN_PER_IP.limit, LOGIN_PER_IP.windowMs);

    // Constant-work path for unknown accounts: same Argon2 verify cost either
    // way, and disabled accounts still pay it — no enumeration via timing.
    // Verification runs outside the row lock; the locked re-read below serializes
    // session creation with administrative password reset.
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true },
    });
    const passwordOk = existing
      ? await verifyPassword(existing.passwordHash, dto.password)
      : (await verifyAgainstDummyHash(dto.password), false);
    if (!existing || !passwordOk) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const authenticated = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
          FROM "users"
         WHERE email = ${email}
         FOR UPDATE`;
      if (!rows[0]) throw new UnauthorizedException(INVALID_CREDENTIALS);

      const user = await tx.user.findUniqueOrThrow({ where: { id: rows[0].id } });
      if (user.passwordHash !== existing.passwordHash || !user.isActive) {
        throw new UnauthorizedException(INVALID_CREDENTIALS);
      }

      const refreshToken = await this.sessions.createSession(user.id, tx);
      await tx.auditEvent.create({
        data: { actorId: user.id, action: 'auth.login' },
      });
      return { user, refreshToken };
    });
    return this.issue(authenticated.user, authenticated.refreshToken);
  }

  /** Rotates the refresh session; re-validates the account server-side. */
  async refresh(rawToken: string | undefined, clientIp: string): Promise<IssuedAuth> {
    this.rateLimit.assertAllowed(`refresh:ip:${clientIp}`, REFRESH_PER_IP.limit, REFRESH_PER_IP.windowMs);
    if (!rawToken) throw new UnauthorizedException('Authentication required');

    const rotated = await this.sessions.rotateSession(rawToken);
    const user = await this.prisma.user.findUnique({ where: { id: rotated.userId } });
    if (!user || !user.isActive) {
      await this.sessions.revokeFamily(rotated.familyId);
      throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    }
    return this.issue(user, rotated.token);
  }

  /** Revokes the session family owning the cookie, if any. Always safe. */
  async logout(rawToken: string | undefined, clientIp: string): Promise<void> {
    this.rateLimit.assertAllowed(`logout:ip:${clientIp}`, LOGOUT_PER_IP.limit, LOGOUT_PER_IP.windowMs);
    if (!rawToken) return;
    const session = await this.sessions.revokeByToken(rawToken);
    if (session) {
      await this.prisma.auditEvent.create({
        data: { actorId: session.userId, action: 'auth.logout' },
      });
    }
  }

  private async issue(user: User, refreshToken: string): Promise<IssuedAuth> {
    const ttlSeconds = this.config.get('accessTokenTtlSeconds', { infer: true });
    const accessToken = await this.tokens.signAccessToken(user, ttlSeconds);
    return { user, accessToken, refreshToken, expiresIn: ttlSeconds };
  }
}

/** Lowercased, trimmed — matches the normalized unique users.email column. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
