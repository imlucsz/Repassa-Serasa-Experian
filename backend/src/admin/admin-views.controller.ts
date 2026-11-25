import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminService } from './admin.service';
import { AdminAuditQueryDto, AdminMaterialQueryDto, AdminReservationQueryDto } from './dto/admin-queries.dto';

/** Read-only operational views across tenants. Access: ADMIN. */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminViewsController {
  constructor(private readonly admin: AdminService) {}

  @Get('materials')
  @ApiOperation({ operationId: 'adminListMaterials', summary: 'adminListMaterials', description: 'Access: ADMIN. All statuses, all institutions.' })
  listMaterials(@Query() query: AdminMaterialQueryDto) {
    return this.admin.listMaterials(query);
  }

  @Get('reservations')
  @ApiOperation({ operationId: 'adminListReservations', summary: 'adminListReservations', description: 'Access: ADMIN. Pickup codes are never exposed.' })
  listReservations(@Query() query: AdminReservationQueryDto) {
    return this.admin.listReservations(query);
  }

  @Get('audit-events')
  @ApiOperation({ operationId: 'adminListAuditEvents', summary: 'adminListAuditEvents', description: 'Access: ADMIN.' })
  listAuditEvents(@Query() query: AdminAuditQueryDto) {
    return this.admin.listAuditEvents(query);
  }
}
