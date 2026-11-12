import type { EmpresaUsuarioRol } from '../../usuarios/entities/empresa-usuario.entity.js';

export interface BaseAccessTokenPayload {
  sub: string;
  email: string;
  sessionId: string;
}

export interface TenantAccessTokenPayload extends BaseAccessTokenPayload {
  empresaId: string;
  rol: EmpresaUsuarioRol;
}

export type AccessTokenPayload =
  BaseAccessTokenPayload | TenantAccessTokenPayload;
