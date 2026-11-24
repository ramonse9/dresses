import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { Cliente } from '../clientes/entities/cliente.tenant-entity.js';
import { DatabaseModule } from '../database/database.module.js';
import { Sucursal } from '../sucursales/entities/sucursal.tenant-entity.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { Vestido } from '../vestidos/entities/vestido.tenant-entity.js';
import { ReservacionVestido } from './entities/reservacion-vestido.tenant-entity.js';
import { Reservacion } from './entities/reservacion.tenant-entity.js';
import { ReservacionesController } from './reservaciones.controller.js';
import { ReservacionesService } from './reservaciones.service.js';

@Module({
  imports: [
    AuthModule,
    AuditModule,
    DatabaseModule,
    TenancyModule,
    UsuariosModule,
    TypeOrmModule.forFeature([
      Reservacion,
      ReservacionVestido,
      Cliente,
      Sucursal,
      Vestido,
    ]),
  ],
  controllers: [ReservacionesController],
  providers: [ReservacionesService],
  exports: [ReservacionesService],
})
export class ReservacionesModule {}
