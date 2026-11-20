import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PageQueryDto } from './dto/page-query.dto';
import { InstitutionsService, type InstitutionPageDto } from './institutions.service';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me/institutions')
export class MyInstitutionsController {
  constructor(private readonly institutions: InstitutionsService) {}

  /** STAFF only — role checked against the DB-fresh identity, scope from memberships. */
  @Get()
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.STAFF)
  @ApiOperation({ operationId: 'listMyInstitutions', summary: 'listMyInstitutions', description: 'Access: STAFF.' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PageQueryDto,
  ): Promise<InstitutionPageDto> {
    return this.institutions.listMemberships(user.id, query);
  }
}
