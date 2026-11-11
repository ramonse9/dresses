import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createTypeOrmOptions } from './database.config.js';
import { DatabaseHealthService } from './database-health.service.js';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: createTypeOrmOptions,
    }),
  ],
  providers: [DatabaseHealthService],
  exports: [DatabaseHealthService],
})
export class DatabaseModule {}
