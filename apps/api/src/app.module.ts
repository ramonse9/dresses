import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { validateApplicationEnvironment } from './config/application-environment.js';
import { DatabaseModule } from './database/database.module.js';
import { EmpresasModule } from './empresas/empresas.module.js';
import { SucursalesModule } from './sucursales/sucursales.module.js';
import { UsuariosModule } from './usuarios/usuarios.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      validate: validateApplicationEnvironment,
    }),
    DatabaseModule,
    EmpresasModule,
    SucursalesModule,
    UsuariosModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
