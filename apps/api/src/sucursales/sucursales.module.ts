import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseModule } from '../database/database.module.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { Sucursal } from './entities/sucursal.tenant-entity.js';
import { SucursalesController } from './sucursales.controller.js';
import { SucursalesService } from './sucursales.service.js';

@Module({
  imports: [
    DatabaseModule,
    TenancyModule,
    TypeOrmModule.forFeature([Sucursal]),
  ],
  controllers: [SucursalesController],
  providers: [SucursalesService],
})
export class SucursalesModule {}
