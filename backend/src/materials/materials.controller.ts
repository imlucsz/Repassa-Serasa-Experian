import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { MaterialsService } from './materials.service';
import type { MaterialDto } from './material.mapper';
import { CatalogQueryDto } from './dto/material-query.dto';

/** Public catalog — AVAILABLE materials at active institutions only. */
@ApiTags('materials')
@Controller('materials')
export class MaterialsController {
  constructor(private readonly materials: MaterialsService) {}

  @Get()
  @ApiOperation({ operationId: 'listMaterials', summary: 'listMaterials', description: 'AVAILABLE only, reconcile expiry before availability-dependent reads.' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, enum: ['BOOK', 'NOTEBOOK', 'SUPPLIES', 'OTHER'] })
  @ApiQuery({ name: 'institutionId', required: false, type: String })
  list(@Query() query: CatalogQueryDto) {
    return this.materials.listCatalog(query);
  }

  @Get(':id')
  @ApiOperation({ operationId: 'getMaterial', summary: 'getMaterial', description: 'AVAILABLE only; inaccessible/unavailable 404.' })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<MaterialDto> {
    return this.materials.getPublicMaterial(id);
  }
}
