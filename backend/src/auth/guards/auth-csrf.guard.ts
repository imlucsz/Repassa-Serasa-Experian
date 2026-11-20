import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyRequest } from 'fastify';
import type { EnvConfig } from '../../config/env.validation';

const REQUEST_MARKER = 'x-repassa-request';

/**
 * CSRF/origin control for cookie-authenticating auth mutations (SECURITY.md):
 * every /auth POST must carry the constant `X-Repassa-Request: 1` marker
 * (which a cross-site form/simple request cannot set), and a present Origin
 * header must be in the configured allowlist. Requests with no Origin at all
 * pass — the explicit non-browser/server pathway documented in SECURITY.md;
 * cookie mutation then still requires the marker header.
 * JSON content-type is additionally enforced by Fastify on body-bearing routes.
 */
@Injectable()
export class AuthCsrfGuard implements CanActivate {
  private readonly allowedOrigins: readonly string[];

  constructor(config: ConfigService<EnvConfig, true>) {
    this.allowedOrigins = config.get('allowedOrigins', { infer: true });
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    if (request.headers[REQUEST_MARKER] !== '1') {
      throw new ForbiddenException('Access denied');
    }
    const origin = request.headers.origin;
    if (origin !== undefined && !this.allowedOrigins.includes(origin)) {
      throw new ForbiddenException('Access denied');
    }
    return true;
  }
}
