import { Body, Controller, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCookieAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { normalizeClientIp } from '../common/rate-limit/ip';
import type { EnvConfig } from '../config/env.validation';
import { toUserDto, type UserDto } from '../users/user.mapper';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { AuthCsrfGuard } from './guards/auth-csrf.guard';

export const REFRESH_COOKIE_NAME = 'repassa_refresh';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

interface AuthResponseBody {
  accessToken: string;
  expiresIn: number;
  user: UserDto;
}

const MARKER_HEADER = {
  name: 'X-Repassa-Request',
  required: true,
  description: 'Constant non-secret browser request marker; Origin allowlist enforced separately.',
} as const;

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly cookieSecure: boolean;
  private readonly cookieMaxAgeSeconds: number;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService<EnvConfig, true>,
  ) {
    this.cookieSecure = config.get('cookieSecure', { infer: true });
    this.cookieMaxAgeSeconds = config.get('refreshTokenTtlDays', { infer: true }) * 86_400;
  }

  /** Student-only registration; sets the HttpOnly refresh cookie. */
  @Post('register')
  @HttpCode(201)
  @UseGuards(AuthCsrfGuard)
  @ApiHeader(MARKER_HEADER)
  @ApiOperation({ operationId: 'register', summary: 'register', description: 'Student only. Enforce allowed browser origin; set refresh cookie.' })
  async register(
    @Body() dto: RegisterDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthResponseBody> {
    const issued = await this.auth.register(dto, normalizeClientIp(request.ip));
    this.setRefreshCookie(reply, issued.refreshToken);
    return { accessToken: issued.accessToken, expiresIn: issued.expiresIn, user: toUserDto(issued.user) };
  }

  @Post('login')
  @HttpCode(200)
  @UseGuards(AuthCsrfGuard)
  @ApiHeader(MARKER_HEADER)
  @ApiOperation({ operationId: 'login', summary: 'login', description: 'All active roles. Generic failures; origin check.' })
  async login(
    @Body() dto: LoginDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthResponseBody> {
    const issued = await this.auth.login(dto, normalizeClientIp(request.ip));
    this.setRefreshCookie(reply, issued.refreshToken);
    return { accessToken: issued.accessToken, expiresIn: issued.expiresIn, user: toUserDto(issued.user) };
  }

  /** Atomically rotates the refresh cookie; replay revokes the whole family. */
  @Post('refresh')
  @HttpCode(200)
  @UseGuards(AuthCsrfGuard)
  @ApiCookieAuth(REFRESH_COOKIE_NAME)
  @ApiHeader(MARKER_HEADER)
  @ApiOperation({ operationId: 'refresh', summary: 'refresh', description: 'Rotate refresh cookie atomically; enforce allowed browser origin.' })
  async refresh(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthResponseBody> {
    const issued = await this.auth.refresh(request.cookies[REFRESH_COOKIE_NAME], normalizeClientIp(request.ip));
    this.setRefreshCookie(reply, issued.refreshToken);
    return { accessToken: issued.accessToken, expiresIn: issued.expiresIn, user: toUserDto(issued.user) };
  }

  /** Revokes the current refresh family if present; always clears the cookie. */
  @Post('logout')
  @HttpCode(204)
  @UseGuards(AuthCsrfGuard)
  @ApiCookieAuth(REFRESH_COOKIE_NAME)
  @ApiHeader(MARKER_HEADER)
  @ApiOperation({ operationId: 'logout', summary: 'logout', description: 'Origin check, revoke refresh family if present, clear cookie. Safe if already logged out.' })
  async logout(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    await this.auth.logout(request.cookies[REFRESH_COOKIE_NAME], normalizeClientIp(request.ip));
    this.clearRefreshCookie(reply);
  }

  /**
   * HttpOnly, host-only, Path-scoped refresh cookie (SECURITY.md). Secure is
   * forced on in production; SameSite=Lax; max age mirrors the session TTL.
   */
  private setRefreshCookie(reply: FastifyReply, token: string): void {
    void reply.setCookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
      maxAge: this.cookieMaxAgeSeconds,
    });
  }

  /** Clears with the exact same attributes used to set the cookie. */
  private clearRefreshCookie(reply: FastifyReply): void {
    void reply.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
    });
  }
}
