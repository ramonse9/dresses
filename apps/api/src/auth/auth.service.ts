import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TenantResolverService } from '../tenancy/tenant-resolver.service.js';
import { EmpresaUsuariosService } from '../usuarios/empresa-usuarios.service.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import { AuthSessionsService } from './auth-sessions.service.js';
import { getJwtAccessTtlSeconds } from './auth.config.js';
import type { EmpresaAccessDto } from './dto/empresa-access.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RefreshTokenDto } from './dto/refresh-token.dto.js';
import type { SelectEmpresaDto } from './dto/select-empresa.dto.js';
import { PasswordHashService } from './password-hash.service.js';
import type {
  AccessTokenPayload,
  TenantAccessTokenPayload,
} from './types/access-token-payload.js';

export interface AccessTokenResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface LoginResponse extends AccessTokenResponse {
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly passwordHashService: PasswordHashService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly authSessionsService: AuthSessionsService,
    private readonly empresaUsuariosService: EmpresaUsuariosService,
    private readonly tenantResolverService: TenantResolverService,
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

  async listEmpresas(payload: AccessTokenPayload): Promise<EmpresaAccessDto[]> {
    const membresias = await this.empresaUsuariosService.findActiveByUsuarioId(
      payload.sub,
    );

    return membresias.map((membresia) => ({
      id: membresia.empresa.id,
      nombre: membresia.empresa.nombre,
      slug: membresia.empresa.slug,
      rol: membresia.rol,
    }));
  }

  async selectEmpresa(
    payload: AccessTokenPayload,
    input: SelectEmpresaDto,
  ): Promise<AccessTokenResponse> {
    const membresia = await this.empresaUsuariosService.findActiveMembership(
      payload.sub,
      input.empresaId,
    );

    if (!membresia) {
      throw new ForbiddenException('No tienes acceso a esta empresa');
    }

    await this.tenantResolverService.resolveByEmpresaId(input.empresaId);

    const selectedPayload: TenantAccessTokenPayload = {
      sub: payload.sub,
      email: payload.email,
      sessionId: payload.sessionId,
      empresaId: membresia.empresaId,
      rol: membresia.rol,
    };

    return this.issueAccessToken(selectedPayload);
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
      ...(await this.issueAccessToken(payload)),
      refreshToken,
    };
  }

  private async issueAccessToken(
    payload: AccessTokenPayload,
  ): Promise<AccessTokenResponse> {
    return {
      accessToken: await this.jwtService.signAsync(payload),
      tokenType: 'Bearer',
      expiresIn: getJwtAccessTtlSeconds(this.configService),
    };
  }
}
