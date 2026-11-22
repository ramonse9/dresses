import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { MailModule } from '../mail/mail.module.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { EmpresaInvitacion } from './entities/empresa-invitacion.entity.js';
import { InvitacionMailService } from './invitacion-mail.service.js';
import { InvitacionTokenService } from './invitacion-token.service.js';
import { InvitacionesController } from './invitaciones.controller.js';
import { InvitacionesService } from './invitaciones.service.js';

@Module({
  imports: [
    AuthModule,
    MailModule,
    TenancyModule,
    UsuariosModule,
    TypeOrmModule.forFeature([EmpresaInvitacion]),
  ],
  controllers: [InvitacionesController],
  providers: [
    InvitacionesService,
    InvitacionTokenService,
    InvitacionMailService,
  ],
  exports: [InvitacionesService],
})
export class InvitacionesModule {}
