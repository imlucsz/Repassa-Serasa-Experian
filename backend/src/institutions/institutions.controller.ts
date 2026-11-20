import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PageQueryDto } from './dto/page-query.dto';
import { InstitutionsService, type InstitutionPageDto } from './institutions.service';

@ApiTags('institutions')
@Controller('institutions')
export class InstitutionsController {
  constructor(private readonly institutions: InstitutionsService) {}

  @Get()
  @ApiOperation({ operationId: 'listInstitutions', summary: 'listInstitutions', description: 'Active institutions only.' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  list(@Query() query: PageQueryDto): Promise<InstitutionPageDto> {
    return this.institutions.listActive(query);
  }
}
