import { SetMetadata } from '@nestjs/common';
import type { Role } from '@prisma/client';

export const ROLES_KEY = 'repassa:roles';

/** Allowed roles for a route — enforced by RolesGuard against the DB-fresh user. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
