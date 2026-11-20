/**
 * Upload policy shared by the multipart registration and the storage service
 * (SECURITY.md): JPEG/PNG/WebP only, <=5 MiB, bounded pixel dimensions,
 * re-encoded (EXIF/metadata stripped) before persistence.
 */
export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const UPLOAD_MAX_DIMENSION = 4096;
export const UPLOAD_MAX_PIXELS = 25_000_000;

export const UPLOAD_RATE_PER_USER = { limit: 10, windowMs: 60_000 };
export const UPLOAD_RATE_PER_IP = { limit: 30, windowMs: 60_000 };

/** detected sharp format -> canonical content type + storage extension. */
export const IMAGE_FORMATS: Record<string, { contentType: string; extension: string }> = {
  jpeg: { contentType: 'image/jpeg', extension: 'jpg' },
  png: { contentType: 'image/png', extension: 'png' },
  webp: { contentType: 'image/webp', extension: 'webp' },
};
