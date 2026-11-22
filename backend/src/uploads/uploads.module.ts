import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { RateLimitModule } from '../common/rate-limit/rate-limit.module';
import type { EnvConfig } from '../config/env.validation';
import { LocalObjectStore } from './local-object-store';
import { ObjectStore } from './object-store';
import { StorageService } from './storage.service';
import { SupabaseObjectStore } from './supabase-object-store';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [AuthModule, RateLimitModule],
  controllers: [UploadsController],
  providers: [
    {
      provide: ObjectStore,
      useFactory: (config: ConfigService<EnvConfig, true>) =>
        config.get('storageDriver', { infer: true }) === 'supabase'
          ? new SupabaseObjectStore(config)
          : new LocalObjectStore(config),
      inject: [ConfigService],
    },
    StorageService,
    UploadsService,
  ],
})
export class UploadsModule {}
