import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
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

@Injectable()
export class InstitutionsService {
  constructor(private readonly prisma: PrismaService) {}

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
    const institution = await this.prisma.$transaction(async (tx) => {
      const created = await tx.institution.create({
        data: {
          name: dto.name.trim(),
          publicAddress: dto.publicAddress.trim(),
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
