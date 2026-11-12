import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmpresaUsuariosService } from './empresa-usuarios.service.js';
import { EmpresaUsuario } from './entities/empresa-usuario.entity.js';
import { Usuario } from './entities/usuario.entity.js';
import { UsuariosService } from './usuarios.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario, EmpresaUsuario])],
  providers: [UsuariosService, EmpresaUsuariosService],
  exports: [UsuariosService, EmpresaUsuariosService],
})
export class UsuariosModule {}
