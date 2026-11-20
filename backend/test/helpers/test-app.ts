import type { ModuleMetadata } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../../src/app.module';
import { FASTIFY_ADAPTER_OPTIONS, configureApp } from '../../src/app.setup';
import type { EnvConfig } from '../../src/config/env.validation';

/**
 * Boots the real application (same adapters/middleware as main.ts) against the
 * disposable test database. `metadata` may add test-only controllers/providers.
 */
export async function createTestApp(
  metadata: ModuleMetadata = {},
): Promise<NestFastifyApplication> {
  const moduleRef = await Test.createTestingModule({
    ...metadata,
    imports: [AppModule, ...(metadata.imports ?? [])],
  }).compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ ...FASTIFY_ADAPTER_OPTIONS }),
    { logger: false },
  );
  await configureApp(app, app.get(ConfigService<EnvConfig, true>));
  await app.init();
  return app;
}
