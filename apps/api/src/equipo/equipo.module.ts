import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { EmpresaUsuario } from '../usuarios/entities/empresa-usuario.entity.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { EquipoController } from './equipo.controller.js';
import { EquipoService } from './equipo.service.js';

@Module({
  imports: [
    AuthModule,
    AuditModule,
    TenancyModule,
    UsuariosModule,
    TypeOrmModule.forFeature([EmpresaUsuario]),
  ],
  controllers: [EquipoController],
  providers: [EquipoService],
})
export class EquipoModule {}
