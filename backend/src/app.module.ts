import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { RateLimitModule } from './common/rate-limit/rate-limit.module';
import { validateEnv } from './config/env.validation';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { InstitutionsModule } from './institutions/institutions.module';
import { MaterialsModule } from './materials/materials.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Tests inject a disposable DATABASE_URL via process.env; never read a dev .env there.
      envFilePath: process.env.NODE_ENV === 'test' ? [] : ['.env'],
      validate: validateEnv,
    }),
    PrismaModule,
    RateLimitModule,
    AuthModule,
    UsersModule,
    InstitutionsModule,
    MaterialsModule,
    UploadsModule,
    HealthModule,
  ],
})
export class AppModule {}
