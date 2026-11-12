import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import { getJwtAccessTtlSeconds } from './auth.config.js';
import type { LoginDto } from './dto/login.dto.js';
import { PasswordHashService } from './password-hash.service.js';
import type { AccessTokenPayload } from './types/access-token-payload.js';

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly passwordHashService: PasswordHashService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(input: LoginDto): Promise<LoginResponse> {
    const usuario = await this.usuariosService.findByEmailForAuthentication(
      input.email,
    );
    const validPassword = await this.passwordHashService.verifyPassword(
      input.password,
      usuario?.passwordHash,
    );

    if (!usuario || !usuario.activo || !validPassword) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload: AccessTokenPayload = {
      sub: usuario.id,
      email: usuario.email,
      sessionId: randomUUID(),
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      tokenType: 'Bearer',
      expiresIn: getJwtAccessTtlSeconds(this.configService),
    };
  }

  getProfile(payload: AccessTokenPayload): AccessTokenPayload {
    return payload;
  }
}
