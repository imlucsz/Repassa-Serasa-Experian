import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TokenService } from '../token.service';

const UNAUTHENTICATED = 'Authentication required';
const BEARER_PATTERN = /^Bearer\s+(\S+)$/i;

/**
 * Bearer access-token guard. Verifies the JWT (signature, pinned HS256,
 * issuer/audience/expiry) and then loads the user fresh from the database:
 * disabled or deleted accounts are rejected even with a valid token, and the
 * attached role comes from the database — never from the possibly stale JWT.
 */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const match = BEARER_PATTERN.exec(request.headers.authorization ?? '');
    if (!match) throw new UnauthorizedException(UNAUTHENTICATED);

    let claims: { sub: string; role: string };
    try {
      claims = await this.tokens.verifyAccessToken(match[1]);
    } catch {
      throw new UnauthorizedException(UNAUTHENTICATED);
    }

    const user = await this.prisma.user.findUnique({ where: { id: claims.sub } });
    if (!user || !user.isActive) throw new UnauthorizedException(UNAUTHENTICATED);

    request.user = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    };
    return true;
  }
}
