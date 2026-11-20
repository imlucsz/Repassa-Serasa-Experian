import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { InstitutionMemberGuard } from '../auth/guards/institution-member.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { normalizeClientIp } from '../common/rate-limit/ip';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  ReservationsService,
  type DashboardDto,
  type PickupResultDto,
} from './reservations.service';
import { PickupConfirmDto } from './dto/reservation.dto';

/**
 * Staff-side dashboard + pickup confirmation — STAFF role plus DB membership
 * on the path institution (no cross-tenant data or code resolution).
 */
@ApiTags('institutions')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard, InstitutionMemberGuard)
@Roles(Role.STAFF)
@Controller('institutions/:institutionId')
export class InstitutionReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Get('dashboard')
  @ApiOperation({
    operationId: 'institutionDashboard',
    summary: 'institutionDashboard',
    description: 'Membership-scoped counts, reconciled expiry.',
  })
  dashboard(@Param('institutionId', ParseUUIDPipe) institutionId: string): Promise<DashboardDto> {
    return this.reservations.dashboard(institutionId);
  }

  @Post('pickups/confirm')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'confirmPickup',
    summary: 'confirmPickup',
    description:
      'Scoped staff, atomic one-time code, valid before expiry; generic invalid code response.',
  })
  confirm(
    @CurrentUser() staff: AuthenticatedUser,
    @Param('institutionId', ParseUUIDPipe) institutionId: string,
    @Body() dto: PickupConfirmDto,
    @Req() request: FastifyRequest,
  ): Promise<PickupResultDto> {
    return this.reservations.confirmPickup(
      staff,
      institutionId,
      dto.code,
      normalizeClientIp(request.ip),
    );
  }
}
