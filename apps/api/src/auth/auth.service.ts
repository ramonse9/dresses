import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import { AuthSessionsService } from './auth-sessions.service.js';
import { getJwtAccessTtlSeconds } from './auth.config.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { PasswordHashService } from './password-hash.service.js';
import type { AccessTokenPayload } from './types/access-token-payload.js';

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
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
    private readonly authSessionsService: AuthSessionsService,
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

    const issuedSession = await this.authSessionsService.create(usuario.id);

    return this.issueTokens(
      usuario.id,
      usuario.email,
      issuedSession.session.id,
      issuedSession.refreshToken,
    );
  }

  async refresh(input: RefreshTokenDto): Promise<LoginResponse> {
    const issuedSession = await this.authSessionsService.rotate(
      input.refreshToken,
    );

    return this.issueTokens(
      issuedSession.usuario.id,
      issuedSession.usuario.email,
      issuedSession.session.id,
      issuedSession.refreshToken,
    );
  }

  async logout(payload: AccessTokenPayload): Promise<void> {
    await this.authSessionsService.revoke(payload.sessionId, payload.sub);
  }

  getProfile(payload: AccessTokenPayload): AccessTokenPayload {
    return payload;
  }

  private async issueTokens(
    usuarioId: string,
    email: string,
    sessionId: string,
    refreshToken: string,
  ): Promise<LoginResponse> {
    const payload: AccessTokenPayload = {
      sub: usuarioId,
      email,
      sessionId,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: getJwtAccessTtlSeconds(this.configService),
    };
  }
}
