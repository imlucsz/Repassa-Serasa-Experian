import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Staff membership check for `/institutions/{institutionId}/...` routes —
 * runs after AccessTokenGuard/RolesGuard and uses only the DB membership
 * table; the institution id from the path is never trusted on its own.
 */
@Injectable()
export class InstitutionMemberGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const user = request.user;
    const institutionId = (request.params as { institutionId?: string }).institutionId;
    if (!user || !institutionId) throw new ForbiddenException('Access denied');

    const membership = await this.prisma.membership.findUnique({
      where: { userId_institutionId: { userId: user.id, institutionId } },
      select: { id: true },
    });
    if (!membership) throw new ForbiddenException('Access denied');
    return true;
  }
}
