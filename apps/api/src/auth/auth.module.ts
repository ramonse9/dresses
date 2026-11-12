import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { AuthController } from './auth.controller.js';
import { getJwtAccessTtlSeconds } from './auth.config.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { PasswordHashService } from './password-hash.service.js';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          algorithm: 'HS256',
          expiresIn: getJwtAccessTtlSeconds(configService),
        },
        verifyOptions: {
          algorithms: ['HS256'],
        },
      }),
    }),
    UsuariosModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordHashService, JwtAuthGuard],
  exports: [AuthService, PasswordHashService, JwtAuthGuard, JwtModule],
})
export class AuthModule {}
