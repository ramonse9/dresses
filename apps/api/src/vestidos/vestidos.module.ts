import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { Sucursal } from '../sucursales/entities/sucursal.tenant-entity.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { Vestido } from './entities/vestido.tenant-entity.js';
import { VestidosController } from './vestidos.controller.js';
import { VestidosService } from './vestidos.service.js';

@Module({
  imports: [
    AuthModule,
    AuditModule,
    DatabaseModule,
    TenancyModule,
    UsuariosModule,
    TypeOrmModule.forFeature([Vestido, Sucursal]),
  ],
  controllers: [VestidosController],
  providers: [VestidosService],
})
export class VestidosModule {}
