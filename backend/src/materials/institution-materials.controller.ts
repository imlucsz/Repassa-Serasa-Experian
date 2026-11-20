import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { InstitutionMemberGuard } from '../auth/guards/institution-member.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { MaterialsService } from './materials.service';
import type { ManagedMaterialDto } from './material.mapper';
import { RejectDto } from './dto/donation.dto';
import { ManagedMaterialQueryDto } from './dto/material-query.dto';

/**
 * Institution stock inbox — STAFF + DB membership (no cross-tenant data).
 * Receive/reject serialize on a locked material row; pending receipt only.
 */
@ApiTags('institutions')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard, InstitutionMemberGuard)
@Roles(Role.STAFF)
@Controller('institutions/:institutionId/materials')
export class InstitutionMaterialsController {
  constructor(private readonly materials: MaterialsService) {}

  @Get()
  @ApiOperation({ operationId: 'institutionMaterials', summary: 'institutionMaterials', description: 'Membership scoped, no cross-tenant data.' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING_RECEIPT', 'AVAILABLE', 'RESERVED', 'DELIVERED', 'CANCELED', 'REJECTED'] })
  @ApiQuery({ name: 'q', required: false, type: String })
  list(
    @Param('institutionId', ParseUUIDPipe) institutionId: string,
    @Query() query: ManagedMaterialQueryDto,
  ) {
    return this.materials.listInstitutionMaterials(institutionId, query);
  }

  @Post(':id/receive')
  @HttpCode(200)
  @ApiOperation({ operationId: 'receiveDonation', summary: 'receiveDonation', description: 'Membership and pending receipt; confirm physical arrival.' })
  receive(
    @CurrentUser() staff: AuthenticatedUser,
    @Param('institutionId', ParseUUIDPipe) institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ManagedMaterialDto> {
    return this.materials.receiveDonation(staff, institutionId, id);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @ApiOperation({ operationId: 'rejectDonation', summary: 'rejectDonation', description: 'Membership and pending receipt; rejected terminal.' })
  reject(
    @CurrentUser() staff: AuthenticatedUser,
    @Param('institutionId', ParseUUIDPipe) institutionId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectDto,
  ): Promise<ManagedMaterialDto> {
    return this.materials.rejectDonation(staff, institutionId, id, dto.reason);
  }
}
