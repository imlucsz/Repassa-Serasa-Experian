import {
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
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ReservationsService } from './reservations.service';
import type { ReservationDto } from './reservation.mapper';
import { MyReservationsQueryDto } from './dto/reservation.dto';

/** Student-side reservation lifecycle — STUDENT only, server-owned scope. */
@ApiTags('reservations')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(Role.STUDENT)
@Controller()
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Post('materials/:id/reservations')
  @HttpCode(201)
  @ApiOperation({
    operationId: 'reserveMaterial',
    summary: 'reserveMaterial',
    description: 'Atomic single live reservation; other than donor.',
  })
  reserve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) materialId: string,
  ): Promise<ReservationDto> {
    return this.reservations.reserve(user, materialId);
  }

  @Get('me/reservations')
  @ApiOperation({ operationId: 'listMyReservations', summary: 'listMyReservations', description: 'Access: STUDENT.' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['ACTIVE', 'CANCELED', 'EXPIRED', 'COMPLETED'] })
  listMine(@CurrentUser() user: AuthenticatedUser, @Query() query: MyReservationsQueryDto) {
    return this.reservations.listMine(user, query);
  }

  @Post('reservations/:id/cancel')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'cancelReservation',
    summary: 'cancelReservation',
    description: 'Owner only, active not expired; code null after cancellation.',
  })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) reservationId: string,
  ): Promise<ReservationDto> {
    return this.reservations.cancel(user, reservationId);
  }
}
