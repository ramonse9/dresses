import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { ClientesModule } from './clientes/clientes.module.js';
import { validateApplicationEnvironment } from './config/application-environment.js';
import { DatabaseModule } from './database/database.module.js';
import { EquipoModule } from './equipo/equipo.module.js';
import { EmpresasModule } from './empresas/empresas.module.js';
import { MailModule } from './mail/mail.module.js';
import { ReservacionesModule } from './reservaciones/reservaciones.module.js';
import { SucursalesModule } from './sucursales/sucursales.module.js';
import { UsuariosModule } from './usuarios/usuarios.module.js';
import { VestidosModule } from './vestidos/vestidos.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      validate: validateApplicationEnvironment,
    }),
    DatabaseModule,
    EquipoModule,
    EmpresasModule,
    SucursalesModule,
    UsuariosModule,
    AuthModule,
    ClientesModule,
    ReservacionesModule,
    VestidosModule,
    MailModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
