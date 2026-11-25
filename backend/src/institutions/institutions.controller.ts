import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PageQueryDto } from './dto/page-query.dto';
import { RegisterInstitutionDto } from './dto/register-institution.dto';
import type { InstitutionDto } from './institution.mapper';
import { InstitutionsService, type InstitutionPageDto } from './institutions.service';

@ApiTags('institutions')
@Controller('institutions')
export class InstitutionsController {
  constructor(private readonly institutions: InstitutionsService) {}

  @Get()
  @ApiOperation({ operationId: 'listInstitutions', summary: 'listInstitutions', description: 'Approved and active institutions only.' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  list(@Query() query: PageQueryDto): Promise<InstitutionPageDto> {
    return this.institutions.listActive(query);
  }

  /** Any authenticated user may submit; the institution stays PENDING until an
   *  admin approves. Submitting grants no role or membership. */
  @Post()
  @HttpCode(201)
  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ operationId: 'registerInstitution', summary: 'registerInstitution', description: 'Access: authenticated. Creates a PENDING institution (admin approval required).' })
  register(@CurrentUser() user: AuthenticatedUser, @Body() dto: RegisterInstitutionDto): Promise<InstitutionDto> {
    return this.institutions.register(user, dto);
  }
}
