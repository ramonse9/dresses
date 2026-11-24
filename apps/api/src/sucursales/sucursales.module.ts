import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { Sucursal } from './entities/sucursal.tenant-entity.js';
import { SucursalesController } from './sucursales.controller.js';
import { SucursalesService } from './sucursales.service.js';

@Module({
  imports: [
    AuthModule,
    AuditModule,
    DatabaseModule,
    TenancyModule,
    UsuariosModule,
    TypeOrmModule.forFeature([Sucursal]),
  ],
  controllers: [SucursalesController],
  providers: [SucursalesService],
})
export class SucursalesModule {}
