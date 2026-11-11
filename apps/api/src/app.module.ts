import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { validateDatabaseEnvironment } from './database/database.config.js';
import { DatabaseModule } from './database/database.module.js';
import { EmpresasModule } from './empresas/empresas.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      validate: validateDatabaseEnvironment,
    }),
    DatabaseModule,
    EmpresasModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
