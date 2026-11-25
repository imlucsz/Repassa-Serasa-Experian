import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RateLimitService } from '../common/rate-limit/rate-limit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { toInstitutionDto, type InstitutionDto } from './institution.mapper';
import type { PageQueryDto } from './dto/page-query.dto';
import type { RegisterInstitutionDto } from './dto/register-institution.dto';

export interface InstitutionPageDto {
  items: InstitutionDto[];
  page: number;
  pageSize: number;
  total: number;
}

/** Anti-spam: an authenticated user may submit at most N institutions/hour. */
const REGISTER_PER_USER = { limit: 5, windowMs: 60 * 60 * 1000 } as const;

@Injectable()
export class InstitutionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rateLimit: RateLimitService,
  ) {}

  /** Public catalog: approved AND active pickup points only, stable name ordering. */
  async listActive(query: PageQueryDto): Promise<InstitutionPageDto> {
    const where = { status: 'APPROVED' as const, isActive: true };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.institution.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.institution.count({ where }),
    ]);
    return { items: items.map(toInstitutionDto), page: query.page, pageSize: query.pageSize, total };
  }

  /**
   * Staff memberships of the caller — institution scope is derived from the
   * membership table server-side; only active institutions are returned.
   */
  async listMemberships(userId: string, query: PageQueryDto): Promise<InstitutionPageDto> {
    const where = { userId, institution: { status: 'APPROVED' as const, isActive: true } };
    const [memberships, total] = await this.prisma.$transaction([
      this.prisma.membership.findMany({
        where,
        include: { institution: true },
        orderBy: { institution: { name: 'asc' } },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.membership.count({ where }),
    ]);
    return {
      items: memberships.map((m) => toInstitutionDto(m.institution)),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  /**
   * Authenticated submission of a new institution — always PENDING. The
   * submitter gains no role, membership or approval power; an ADMIN must
   * approve before the institution is public or operational.
   */
  async register(user: AuthenticatedUser, dto: RegisterInstitutionDto): Promise<InstitutionDto> {
    // Bounded per-submitter registration rate — spam stays cheap to reject.
    this.rateLimit.assertAllowed(`institution.register:${user.id}`, REGISTER_PER_USER.limit, REGISTER_PER_USER.windowMs);

    const name = dto.name.trim();
    const address = dto.publicAddress.trim();
    const institution = await this.prisma.$transaction(async (tx) => {
      // Advisory lock keyed on the normalized pair serializes concurrent
      // duplicate submissions of the same institution inside this tx only.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${name.toLowerCase()}|${address.toLowerCase()}`}))`;
      const existing = await tx.institution.findFirst({
        where: {
          status: { not: 'REJECTED' },
          name: { equals: name, mode: 'insensitive' },
          publicAddress: { equals: address, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (existing) throw new ConflictException('An institution with this name and address is already registered');
      const created = await tx.institution.create({
        data: {
          name,
          publicAddress: address,
          pickupInstructions: dto.pickupInstructions.trim(),
          status: 'PENDING',
          isActive: false,
        },
      });
      await tx.auditEvent.create({
        data: { actorId: user.id, institutionId: created.id, action: 'institution.register' },
      });
      return created;
    });
    return toInstitutionDto(institution);
  }
}
