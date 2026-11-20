import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { ReadStream } from 'node:fs';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import {
  IMAGE_FORMATS,
  UPLOAD_MAX_BYTES,
  UPLOAD_MAX_DIMENSION,
  UPLOAD_MAX_PIXELS,
} from './upload-policy';
import type { EnvConfig } from '../config/env.validation';

/** `<uuid>.<ext>` — keys are generated server-side, never client-controlled. */
const KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export interface StoredImage {
  key: string;
  contentType: string;
  sizeBytes: number;
}

/**
 * Local-disk object store for material photos. Pending images stay private —
 * files are never exposed by directory listing and only served through the
 * authorized `GET /uploads/:key` route. A future object-storage backend
 * (Supabase/S3) can replace this service without touching callers.
 */
@Injectable()
export class StorageService {
  private readonly rootDir: string;

  constructor(config: ConfigService<EnvConfig, true>) {
    this.rootDir = resolve(config.get('uploadDir', { infer: true }));
  }

  /**
   * Validates the real image payload (magic bytes via decoder, not the
   * declared mimetype), enforces pixel limits, re-encodes to strip EXIF and
   * any embedded metadata, and writes under a random object key.
   */
  async processAndStore(buffer: Buffer, declaredType: string | undefined): Promise<StoredImage> {
    if (buffer.length === 0 || buffer.length > UPLOAD_MAX_BYTES) {
      throw new BadRequestException('Invalid image file');
    }
    if (declaredType && !Object.values(IMAGE_FORMATS).some((f) => f.contentType === declaredType)) {
      throw new BadRequestException('Unsupported image type');
    }

    let pipeline: sharp.Sharp;
    let format: string;
    try {
      // limitInputPixels + bounded dims guard decompression bombs.
      pipeline = sharp(buffer, { limitInputPixels: UPLOAD_MAX_PIXELS, failOn: 'error' });
      const meta = await pipeline.metadata();
      format = meta.format ?? '';
      if (!IMAGE_FORMATS[format] || !meta.width || !meta.height) {
        throw new BadRequestException('Unsupported image type');
      }
      if (meta.width > UPLOAD_MAX_DIMENSION || meta.height > UPLOAD_MAX_DIMENSION) {
        throw new BadRequestException('Image dimensions too large');
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Invalid image file');
    }

    const expected = IMAGE_FORMATS[format];
    if (declaredType && declaredType !== expected.contentType) {
      throw new BadRequestException('Invalid image file');
    }

    // rotate() applies EXIF orientation; re-encode drops all metadata chunks.
    const encoded =
      format === 'jpeg'
        ? await pipeline.rotate().jpeg({ quality: 90, mozjpeg: true }).toBuffer()
        : format === 'png'
          ? await pipeline.png({ compressionLevel: 9 }).toBuffer()
          : await pipeline.webp({ quality: 85 }).toBuffer();

    const key = `${randomUUID()}.${expected.extension}`;
    await mkdir(this.rootDir, { recursive: true });
    await writeFile(this.resolvePath(key), encoded, { flag: 'wx' });
    return { key, contentType: expected.contentType, sizeBytes: encoded.length };
  }

  /** Resolves a stored key to a stream — rejects anything not matching the key shape. */
  openReadStream(key: string): ReadStream | undefined {
    if (!KEY_PATTERN.test(key)) return undefined;
    const path = this.resolvePath(key);
    if (!existsSync(path)) return undefined;
    try {
      return createReadStream(path);
    } catch {
      return undefined;
    }
  }

  private resolvePath(key: string): string {
    return join(this.rootDir, key);
  }
}
