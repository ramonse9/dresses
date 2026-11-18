import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import { createCorsOptions } from './config/cors.config.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors(createCorsOptions(app.get(ConfigService)));

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
