import { ExecutionContext, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { AuthenticatedUser } from '../auth.types';

/** Requires a prior AccessTokenGuard; returns the DB-fresh request identity. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    if (!request.user) throw new UnauthorizedException('Authentication required');
    return request.user;
  },
);
