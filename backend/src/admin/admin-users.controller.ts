import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AdminService } from './admin.service';
import type { AdminUserDto } from './admin.mapper';
import { AdminUserQueryDto } from './dto/admin-queries.dto';
import { SetUserRoleDto } from './dto/admin-requests.dto';

/** User administration — list, activate/deactivate, STUDENT↔STAFF roles. Access: ADMIN. */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/users')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminUsersController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  @ApiOperation({ operationId: 'adminListUsers', summary: 'adminListUsers', description: 'Access: ADMIN.' })
  list(@Query() query: AdminUserQueryDto) {
    return this.admin.listUsers(query);
  }

  @Post(':id/role')
  @HttpCode(200)
  @ApiOperation({ operationId: 'adminSetUserRole', summary: 'adminSetUserRole', description: 'Access: ADMIN. STUDENT↔STAFF only; ADMIN roles are provisioned out of band.' })
  setRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserRoleDto,
  ): Promise<AdminUserDto> {
    return this.admin.setUserRole(user, id, dto.role);
  }

  @Post(':id/activate')
  @HttpCode(200)
  @ApiOperation({ operationId: 'adminActivateUser', summary: 'adminActivateUser', description: 'Access: ADMIN.' })
  activate(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<AdminUserDto> {
    return this.admin.activateUser(user, id);
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  @ApiOperation({ operationId: 'adminDeactivateUser', summary: 'adminDeactivateUser', description: 'Access: ADMIN. Revokes all refresh sessions.' })
  deactivate(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<AdminUserDto> {
    return this.admin.deactivateUser(user, id);
  }
}
