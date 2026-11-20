import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Role check against the DB-fresh identity attached by AccessTokenGuard
 * (must run after it). Membership-level scoping stays in services.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    if (!request.user || !roles.includes(request.user.role)) {
      throw new ForbiddenException('Access denied');
    }
    return true;
  }
}
