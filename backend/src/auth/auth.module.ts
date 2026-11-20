import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AccessTokenGuard } from './guards/access-token.guard';
import { AuthCsrfGuard } from './guards/auth-csrf.guard';
import { RolesGuard } from './guards/roles.guard';
import { SessionService } from './session.service';
import { TokenService } from './token.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionService, TokenService, AccessTokenGuard, AuthCsrfGuard, RolesGuard],
  // Other modules use the guards via @UseGuards; their dependencies must be
  // resolvable there, so TokenService is exported.
  exports: [TokenService],
})
export class AuthModule {}
