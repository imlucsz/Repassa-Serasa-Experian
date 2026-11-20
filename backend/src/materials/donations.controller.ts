import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { MaterialsService } from './materials.service';
import type { ManagedMaterialDto } from './material.mapper';
import { DonationDto } from './dto/donation.dto';
import { MyDonationsQueryDto } from './dto/material-query.dto';

/** Donor-side donation lifecycle — STUDENT only, server-owned donor/status. */
@ApiTags('donations')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(Role.STUDENT)
@Controller()
export class DonationsController {
  constructor(private readonly materials: MaterialsService) {}

  @Post('donations')
  @HttpCode(201)
  @ApiOperation({ operationId: 'createDonation', summary: 'createDonation', description: 'Creates one PENDING_RECEIPT material; uploadId optional, own unused upload only.' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DonationDto,
  ): Promise<ManagedMaterialDto> {
    return this.materials.createDonation(user, dto);
  }

  @Get('me/donations')
  @ApiOperation({ operationId: 'listMyDonations', summary: 'listMyDonations', description: 'Access: STUDENT.' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING_RECEIPT', 'AVAILABLE', 'RESERVED', 'DELIVERED', 'CANCELED', 'REJECTED'] })
  listMine(@CurrentUser() user: AuthenticatedUser, @Query() query: MyDonationsQueryDto) {
    return this.materials.listMyDonations(user, query);
  }

  @Post('donations/:id/cancel')
  @HttpCode(200)
  @ApiOperation({ operationId: 'cancelDonation', summary: 'cancelDonation', description: 'Owner only, pending receipt only.' })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ManagedMaterialDto> {
    return this.materials.cancelDonation(user, id);
  }
}
