import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { normalizeClientIp } from '../common/rate-limit/ip';
import { RateLimitService } from '../common/rate-limit/rate-limit.service';
import { TokenService } from '../auth/token.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { StorageService, type StoredImage } from './storage.service';
import { UPLOAD_RATE_PER_IP, UPLOAD_RATE_PER_USER } from './upload-policy';

const BEARER_PATTERN = /^Bearer\s+(\S+)$/i;

@Injectable()
export class UploadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly tokens: TokenService,
    private readonly rateLimit: RateLimitService,
  ) {}

  /**
   * Stores a validated owner-bound image and returns the contract uploadId.
   * The Upload row tracks ownership so it can only be attached once by its
   * owner (consumedAt set inside the donation transaction).
   */
  async createUpload(
    user: AuthenticatedUser,
    clientIp: string,
    buffer: Buffer,
    declaredType: string | undefined,
  ): Promise<{ uploadId: string }> {
    const ip = normalizeClientIp(clientIp);
    this.rateLimit.assertAllowed(
      `upload:user:${user.id}`,
      UPLOAD_RATE_PER_USER.limit,
      UPLOAD_RATE_PER_USER.windowMs,
    );
    this.rateLimit.assertAllowed(
      `upload:ip:${ip}`,
      UPLOAD_RATE_PER_IP.limit,
      UPLOAD_RATE_PER_IP.windowMs,
    );

    const stored: StoredImage = await this.storage.processAndStore(buffer, declaredType);
    const upload = await this.prisma.upload.create({
      data: {
        key: stored.key,
        ownerId: user.id,
        contentType: stored.contentType,
        sizeBytes: stored.sizeBytes,
      },
    });
    return { uploadId: upload.id };
  }

  /**
   * Authorization for serving an object (SECURITY.md): public only while the
   * attached material is AVAILABLE; otherwise the donor, the upload owner, or
   * a staff member of the material's institution. Hidden resources answer 404.
   */
  async serveAuthorization(
    key: string,
    user: AuthenticatedUser | undefined,
  ): Promise<'public' | 'private' | undefined> {
    const material = await this.prisma.material.findFirst({
      where: { imageKey: key },
      select: { status: true, donorId: true, institutionId: true },
    });
    if (material?.status === 'AVAILABLE') return 'public';
    if (!user) return undefined;

    if (material) {
      if (material.donorId === user.id) return 'private';
      const membership = await this.prisma.membership.findUnique({
        where: { userId_institutionId: { userId: user.id, institutionId: material.institutionId } },
        select: { id: true },
      });
      if (membership) return 'private';
      return undefined;
    }

    const upload = await this.prisma.upload.findUnique({
      where: { key },
      select: { ownerId: true, contentType: true },
    });
    return upload?.ownerId === user.id ? 'private' : undefined;
  }

  /** Best-effort bearer authentication for the optionally-public serve route. */
  async tryAuthenticate(authorization: string | undefined): Promise<AuthenticatedUser | undefined> {
    const match = BEARER_PATTERN.exec(authorization ?? '');
    if (!match) return undefined;
    let claims: { sub: string; credentialVersion: string };
    try {
      claims = await this.tokens.verifyAccessToken(match[1]);
    } catch {
      return undefined;
    }
    const user = await this.prisma.user.findUnique({ where: { id: claims.sub } });
    if (
      !user ||
      !user.isActive ||
      !this.tokens.matchesPasswordCredential(claims.credentialVersion, user.passwordHash)
    )
      return undefined;
    return { id: user.id, email: user.email, displayName: user.displayName, role: user.role };
  }

  async contentTypeFor(key: string): Promise<string> {
    const upload = await this.prisma.upload.findUnique({
      where: { key },
      select: { contentType: true },
    });
    if (!upload) throw new NotFoundException('Not found');
    return upload.contentType;
  }
}
