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

export interface RunningTestApp {
  app: NestFastifyApplication;
  baseUrl: string;
}

/**
 * Starts the test app on an ephemeral port. E2E specs use real HTTP requests
 * (fetch) rather than fastify inject(): inject routes through light-my-request,
 * which is a test-only path absent from production traffic.
 */
export async function startTestApp(
  metadata: ModuleMetadata = {},
): Promise<RunningTestApp> {
  const app = await createTestApp(metadata);
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;
  return { app, baseUrl: `http://127.0.0.1:${port}` };
}
