import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: ['http://localhost:4200', 'http://127.0.0.1:4200'],
  });

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
