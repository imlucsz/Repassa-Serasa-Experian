import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { API_PREFIX, FASTIFY_ADAPTER_OPTIONS, configureApp, setupSwagger } from './app.setup';
import type { EnvConfig } from './config/env.validation';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ ...FASTIFY_ADAPTER_OPTIONS }),
  );
  const config = app.get(ConfigService<EnvConfig, true>);
  await configureApp(app, config);

  if (config.get('swaggerEnabled', { infer: true })) {
    setupSwagger(app);
    logger.log('Swagger UI enabled at /api/docs');
  }

  const port = config.get('port', { infer: true });
  const host = config.get('host', { infer: true });
  await app.listen(port, host);
  logger.log(`RePassa API listening on http://${host}:${port}/${API_PREFIX}`);
}

void bootstrap();
