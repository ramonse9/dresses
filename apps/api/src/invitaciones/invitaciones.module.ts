import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { MailModule } from '../mail/mail.module.js';
import { AuthRateLimitModule } from '../security/auth-rate-limit/auth-rate-limit.module.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { EmpresaInvitacion } from './entities/empresa-invitacion.entity.js';
import { InvitacionMailService } from './invitacion-mail.service.js';
import { InvitacionTokenService } from './invitacion-token.service.js';
import { InvitacionesAceptacionService } from './invitaciones-aceptacion.service.js';
import { InvitacionesController } from './invitaciones.controller.js';
import { InvitacionesPublicasController } from './invitaciones-publicas.controller.js';
import { InvitacionesService } from './invitaciones.service.js';

@Module({
  imports: [
    AuthModule,
    AuditModule,
    MailModule,
    TenancyModule,
    UsuariosModule,
    AuthRateLimitModule,
    TypeOrmModule.forFeature([EmpresaInvitacion]),
  ],
  controllers: [InvitacionesController, InvitacionesPublicasController],
  providers: [
    InvitacionesService,
    InvitacionesAceptacionService,
    InvitacionTokenService,
    InvitacionMailService,
  ],
  exports: [InvitacionesService, InvitacionesAceptacionService],
})
export class InvitacionesModule {}
