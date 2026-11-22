import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import sharp from 'sharp';
import {
  IMAGE_FORMATS,
  UPLOAD_MAX_BYTES,
  UPLOAD_MAX_DIMENSION,
  UPLOAD_MAX_PIXELS,
} from './upload-policy';
import { ObjectStore, OBJECT_KEY_PATTERN } from './object-store';

export interface StoredImage {
  key: string;
  contentType: string;
  sizeBytes: number;
}

/**
 * Upload validation + processing pipeline. Owns magic-byte checks, dimension
 * limits and re-encoding (EXIF/metadata stripped); persistence is delegated
 * to the configured ObjectStore driver (local disk in dev/test, durable
 * object storage in staging/production). The public surface —
 * `processAndStore` and `getObject` — is identical for every driver so
 * callers, authorization and the API contract do not change.
 */
@Injectable()
export class StorageService {
  constructor(private readonly store: ObjectStore) {}

  /**
   * Validates the real image payload (magic bytes via decoder, not the
   * declared mimetype), enforces pixel limits, re-encodes to strip EXIF and
   * any embedded metadata, and stores under a random private key.
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
    await this.store.put(key, encoded, expected.contentType);
    return { key, contentType: expected.contentType, sizeBytes: encoded.length };
  }

  /** Returns stored bytes for an authorized caller — rejects non-key shapes. */
  getObject(key: string): Promise<Buffer | undefined> {
    if (!OBJECT_KEY_PATTERN.test(key)) return Promise.resolve(undefined);
    return this.store.get(key);
  }
}
