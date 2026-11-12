import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { AuthController } from './auth.controller.js';
import { AuthSessionsService } from './auth-sessions.service.js';
import { getJwtAccessTtlSeconds } from './auth.config.js';
import { AuthService } from './auth.service.js';
import { AuthSession } from './entities/auth-session.entity.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { PasswordHashService } from './password-hash.service.js';
import { RefreshTokenService } from './refresh-token.service.js';

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
    TypeOrmModule.forFeature([AuthSession]),
    UsuariosModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthSessionsService,
    PasswordHashService,
    RefreshTokenService,
    JwtAuthGuard,
  ],
  exports: [
    AuthService,
    AuthSessionsService,
    PasswordHashService,
    JwtAuthGuard,
    JwtModule,
  ],
})
export class AuthModule {}
