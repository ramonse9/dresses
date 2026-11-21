import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import { createCorsOptions } from './config/cors.config.js';
import { configureTrustProxy } from './config/trust-proxy.config.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  const configService = app.get(ConfigService);
  configureTrustProxy(app, configService);
  app.enableCors(createCorsOptions(configService));

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
