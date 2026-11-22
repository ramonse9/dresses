import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmpresaInvitacion } from './entities/empresa-invitacion.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([EmpresaInvitacion])],
  exports: [TypeOrmModule],
})
export class InvitacionesModule {}
