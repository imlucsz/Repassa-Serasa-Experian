import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { StorageService } from './storage.service';
import { UploadsService } from './uploads.service';

const NOT_FOUND = 'Not found';

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(
    private readonly uploads: UploadsService,
    private readonly storage: StorageService,
  ) {}

  /**
   * POST /uploads — owner-bound validated image (JPEG/PNG/WebP, <=5 MiB).
   * The file is re-encoded server-side (EXIF/metadata stripped) and stored
   * under a random private key; only the contract uploadId is returned.
   */
  @Post()
  @HttpCode(201)
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ operationId: 'uploadMaterialPhoto', summary: 'uploadMaterialPhoto', description: 'Owner-bound validated JPEG/PNG/WebP <=5 MiB, private until public availability.' })
  async upload(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
  ): Promise<{ uploadId: string }> {
    const file = await request.file();
    if (!file) throw new BadRequestException('Invalid image file');
    let buffer: Buffer;
    try {
      buffer = await file.toBuffer();
    } catch {
      // Over the 5 MiB multipart limit -> validation-style failure, not 500.
      throw new BadRequestException('Invalid image file');
    }
    return this.uploads.createUpload(user, request.ip, buffer, file.mimetype);
  }

  /**
   * GET /uploads/:key — controlled object serving (internal route supporting
   * the contract imageUrl semantics): public only while the material is
   * AVAILABLE, otherwise donor / upload owner / member staff with a Bearer
   * token. Anything else is a generic 404 — no existence or tenant leak.
   */
  @Get(':key')
  @ApiOperation({ operationId: 'serveUpload', summary: 'serveUpload', description: 'Internal controlled object route backing Material.imageUrl; not part of the public contract surface.' })
  async serve(
    @Param('key') key: string,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<FastifyReply> {
    const user = await this.uploads.tryAuthenticate(request.headers.authorization);
    const access = await this.uploads.serveAuthorization(key, user);
    const body = access ? await this.storage.getObject(key) : undefined;
    if (!access || !body) throw new NotFoundException(NOT_FOUND);

    const contentType = await this.uploads.contentTypeFor(key);
    return reply
      .header('content-type', contentType)
      .header('x-content-type-options', 'nosniff')
      .send(body);
  }
}
