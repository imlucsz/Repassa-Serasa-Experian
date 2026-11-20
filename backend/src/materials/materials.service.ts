import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { MaterialStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { ReservationExpiryService } from '../reservations/reservation-expiry.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  toManagedMaterialDto,
  toMaterialDto,
  type ManagedMaterialDto,
  type MaterialDto,
} from './material.mapper';
import type { CatalogQueryDto, ManagedMaterialQueryDto } from './dto/material-query.dto';
import type { DonationDto } from './dto/donation.dto';

const NOT_FOUND = 'Not found';
const TRANSITION_CONFLICT = 'Material state does not allow this action';

interface ManagedPage {
  items: ManagedMaterialDto[];
  page: number;
  pageSize: number;
  total: number;
}

interface LockedMaterialRow {
  id: string;
  donorId: string;
  institutionId: string;
  status: MaterialStatus;
}

/** Materials domain service — donation lifecycle + institution stock. */
@Injectable()
export class MaterialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expiry: ReservationExpiryService,
  ) {}

  /** Public catalog: AVAILABLE at active institutions only. */
  async listCatalog(query: CatalogQueryDto): Promise<{
    items: MaterialDto[];
    page: number;
    pageSize: number;
    total: number;
  }> {
    // Expired reservations restore their materials before availability reads.
    await this.expiry.reconcileExpired();
    const where: Prisma.MaterialWhereInput = {
      status: 'AVAILABLE',
      institution: { isActive: true },
      ...(query.category ? { category: query.category } : {}),
      ...(query.institutionId ? { institutionId: query.institutionId } : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' as const } },
              { description: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.material.findMany({
        where,
        include: { institution: true },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.material.count({ where }),
    ]);
    return { items: items.map(toMaterialDto), page: query.page, pageSize: query.pageSize, total };
  }

  /** Public detail: AVAILABLE only — anything else is a generic 404. */
  async getPublicMaterial(id: string): Promise<MaterialDto> {
    await this.expiry.reconcileExpired({ materialId: id });
    const material = await this.prisma.material.findFirst({
      where: { id, status: 'AVAILABLE', institution: { isActive: true } },
      include: { institution: true },
    });
    if (!material) throw new NotFoundException(NOT_FOUND);
    return toMaterialDto(material);
  }

  /**
   * Student donation -> PENDING_RECEIPT. uploadId must be an unconsumed upload
   * owned by the donor; the consume + material create + audit commit together.
   */
  async createDonation(donor: AuthenticatedUser, dto: DonationDto): Promise<ManagedMaterialDto> {
    const institution = await this.prisma.institution.findUnique({
      where: { id: dto.institutionId },
      select: { isActive: true },
    });
    if (!institution?.isActive) {
      throw new BadRequestException({
        message: 'Validation failed',
        fieldErrors: { institutionId: ['must reference an active institution'] },
      });
    }

    let imageKey: string | null = null;
    if (dto.uploadId) {
      const upload = await this.prisma.upload.findUnique({ where: { id: dto.uploadId } });
      if (!upload || upload.ownerId !== donor.id) {
        throw new BadRequestException({
          message: 'Validation failed',
          fieldErrors: { uploadId: ['must reference a usable own upload'] },
        });
      }
      imageKey = upload.key;
    }

    const material = await this.prisma.$transaction(async (tx) => {
      if (dto.uploadId) {
        // TOCTOU-safe consume: exactly one donation may claim an upload.
        const claimed = await tx.upload.updateMany({
          where: { id: dto.uploadId, ownerId: donor.id, consumedAt: null },
          data: { consumedAt: new Date() },
        });
        if (claimed.count === 0) {
          throw new BadRequestException({
            message: 'Validation failed',
            fieldErrors: { uploadId: ['must reference a usable own upload'] },
          });
        }
      }
      const created = await tx.material.create({
        data: {
          donorId: donor.id,
          institutionId: dto.institutionId,
          title: dto.title.trim(),
          description: dto.description.trim(),
          category: dto.category,
          condition: dto.condition,
          imageKey,
          status: 'PENDING_RECEIPT',
        },
        include: { institution: true },
      });
      await tx.auditEvent.create({
        data: {
          actorId: donor.id,
          institutionId: created.institutionId,
          materialId: created.id,
          action: 'material.donate',
        },
      });
      return created;
    });
    return toManagedMaterialDto(material);
  }

  /** Donor history — own materials only, any status. */
  async listMyDonations(
    user: AuthenticatedUser,
    query: { status?: MaterialStatus; page: number; pageSize: number },
  ): Promise<ManagedPage> {
    const where: Prisma.MaterialWhereInput = {
      donorId: user.id,
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.material.findMany({
        where,
        include: { institution: true },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.material.count({ where }),
    ]);
    return {
      items: items.map(toManagedMaterialDto),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  /** Donor cancel: own PENDING_RECEIPT only. Row lock serializes vs staff. */
  async cancelDonation(user: AuthenticatedUser, id: string): Promise<ManagedMaterialDto> {
    const material = await this.prisma.$transaction(async (tx) => {
      const row = await this.lockMaterial(tx, id);
      if (!row || row.donorId !== user.id) throw new NotFoundException(NOT_FOUND);
      if (row.status !== 'PENDING_RECEIPT') throw new ConflictException(TRANSITION_CONFLICT);
      const updated = await tx.material.update({
        where: { id: row.id },
        data: { status: 'CANCELED' },
        include: { institution: true },
      });
      await tx.auditEvent.create({
        data: {
          actorId: user.id,
          institutionId: row.institutionId,
          materialId: row.id,
          action: 'material.donation_cancel',
        },
      });
      return updated;
    });
    return toManagedMaterialDto(material);
  }

  /** Staff stock view — scoped to the membership-checked institution. */
  async listInstitutionMaterials(
    institutionId: string,
    query: ManagedMaterialQueryDto,
  ): Promise<ManagedPage> {
    await this.expiry.reconcileExpired({ institutionId });
    const where: Prisma.MaterialWhereInput = {
      institutionId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' as const } },
              { description: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.material.findMany({
        where,
        include: { institution: true },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.material.count({ where }),
    ]);
    return {
      items: items.map(toManagedMaterialDto),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  /**
   * Staff receipt confirmation: PENDING_RECEIPT -> AVAILABLE with actor +
   * timestamp. Membership is enforced by guard; institution match is enforced
   * again in the row lookup so cross-tenant ids are generic 404s.
   */
  async receiveDonation(
    staff: AuthenticatedUser,
    institutionId: string,
    id: string,
  ): Promise<ManagedMaterialDto> {
    const material = await this.prisma.$transaction(async (tx) => {
      const row = await this.lockMaterial(tx, id);
      if (!row || row.institutionId !== institutionId) throw new NotFoundException(NOT_FOUND);
      if (row.status !== 'PENDING_RECEIPT') throw new ConflictException(TRANSITION_CONFLICT);
      const updated = await tx.material.update({
        where: { id: row.id },
        data: { status: 'AVAILABLE', receivedAt: new Date(), receivedBy: staff.id },
        include: { institution: true },
      });
      await tx.auditEvent.create({
        data: {
          actorId: staff.id,
          institutionId,
          materialId: row.id,
          action: 'material.receive',
        },
      });
      return updated;
    });
    return toManagedMaterialDto(material);
  }

  /** Staff rejection: PENDING_RECEIPT -> REJECTED (terminal) with reason. */
  async rejectDonation(
    staff: AuthenticatedUser,
    institutionId: string,
    id: string,
    reason: string,
  ): Promise<ManagedMaterialDto> {
    const material = await this.prisma.$transaction(async (tx) => {
      const row = await this.lockMaterial(tx, id);
      if (!row || row.institutionId !== institutionId) throw new NotFoundException(NOT_FOUND);
      if (row.status !== 'PENDING_RECEIPT') throw new ConflictException(TRANSITION_CONFLICT);
      const updated = await tx.material.update({
        where: { id: row.id },
        data: { status: 'REJECTED', rejectReason: reason.trim() },
        include: { institution: true },
      });
      await tx.auditEvent.create({
        data: {
          actorId: staff.id,
          institutionId,
          materialId: row.id,
          action: 'material.reject',
        },
      });
      return updated;
    });
    return toManagedMaterialDto(material);
  }

  /** Locks one material row FOR UPDATE inside the caller's transaction. */
  private async lockMaterial(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<LockedMaterialRow | undefined> {
    if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id)) {
      return undefined;
    }
    const rows = await tx.$queryRaw<LockedMaterialRow[]>`
      SELECT id,
             donor_id AS "donorId",
             institution_id AS "institutionId",
             status
        FROM materials
        WHERE id = ${id}::uuid
        FOR UPDATE`;
    return rows[0];
  }
}
