import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AdminService } from './admin.service';
import type { AdminInstitutionDto, AdminMemberDto } from './admin.mapper';
import { AdminInstitutionQueryDto } from './dto/admin-queries.dto';
import { AssignMemberDto, RejectInstitutionDto } from './dto/admin-requests.dto';

/** Institution lifecycle + staff membership administration. Access: ADMIN. */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/institutions')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminInstitutionsController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  @ApiOperation({ operationId: 'adminListInstitutions', summary: 'adminListInstitutions', description: 'Access: ADMIN.' })
  list(@Query() query: AdminInstitutionQueryDto) {
    return this.admin.listInstitutions(query);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @ApiOperation({ operationId: 'adminApproveInstitution', summary: 'adminApproveInstitution', description: 'Access: ADMIN. PENDING → APPROVED.' })
  approve(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<AdminInstitutionDto> {
    return this.admin.approveInstitution(user, id);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @ApiOperation({ operationId: 'adminRejectInstitution', summary: 'adminRejectInstitution', description: 'Access: ADMIN. PENDING → REJECTED (terminal), reason required.' })
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectInstitutionDto,
  ): Promise<AdminInstitutionDto> {
    return this.admin.rejectInstitution(user, id, dto.reason);
  }

  @Post(':id/activate')
  @HttpCode(200)
  @ApiOperation({ operationId: 'adminActivateInstitution', summary: 'adminActivateInstitution', description: 'Access: ADMIN. isActive → true (APPROVED only).' })
  activate(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<AdminInstitutionDto> {
    return this.admin.activateInstitution(user, id);
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  @ApiOperation({ operationId: 'adminDeactivateInstitution', summary: 'adminDeactivateInstitution', description: 'Access: ADMIN. isActive → false (APPROVED only).' })
  deactivate(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<AdminInstitutionDto> {
    return this.admin.deactivateInstitution(user, id);
  }

  @Get(':id/members')
  @ApiOperation({ operationId: 'adminListInstitutionMembers', summary: 'adminListInstitutionMembers', description: 'Access: ADMIN.' })
  listMembers(@Param('id', ParseUUIDPipe) id: string): Promise<AdminMemberDto[]> {
    return this.admin.listMembers(id);
  }

  @Post(':id/members')
  @ApiOperation({ operationId: 'adminAssignInstitutionMember', summary: 'adminAssignInstitutionMember', description: 'Access: ADMIN. Grants STAFF role + membership atomically.' })
  assignMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignMemberDto,
  ): Promise<AdminMemberDto> {
    return this.admin.assignMember(user, id, dto.userId);
  }

  @Post(':id/members/:userId/revoke')
  @HttpCode(204)
  @ApiOperation({ operationId: 'adminRevokeInstitutionMember', summary: 'adminRevokeInstitutionMember', description: 'Access: ADMIN. Demotes to STUDENT when the last membership is revoked.' })
  revokeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    return this.admin.revokeMember(user, id, userId);
  }
}
