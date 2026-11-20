import type { Role } from '@prisma/client';

/**
 * Identity attached to the request by AccessTokenGuard. Always loaded fresh
 * from the database (isActive + role checked server-side per request); the JWT
 * only carries the subject — we never trust a possibly stale token role.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}
