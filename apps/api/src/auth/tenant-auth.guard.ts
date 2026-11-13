import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { TenantResolverService } from '../tenancy/tenant-resolver.service.js';
import type { TenantScope } from '../tenancy/tenant-scope.js';
import { EmpresaUsuariosService } from '../usuarios/empresa-usuarios.service.js';
import type { EmpresaUsuarioRol } from '../usuarios/entities/empresa-usuario.entity.js';
import type { AuthenticatedRequest } from './jwt-auth.guard.js';

export type VerifiedTenantMembership = Readonly<{
  usuarioId: string;
  empresaId: string;
  rol: EmpresaUsuarioRol;
}>;

export interface TenantAuthenticatedRequest extends AuthenticatedRequest {
  tenantScope?: TenantScope;
  tenantMembership?: VerifiedTenantMembership;
}

@Injectable()
export class TenantAuthGuard implements CanActivate {
  constructor(
    private readonly tenantResolverService: TenantResolverService,
    private readonly empresaUsuariosService: EmpresaUsuariosService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<TenantAuthenticatedRequest>();
    const user = request.user;

    if (!user || !('empresaId' in user)) {
      throw new ForbiddenException('Empresa no seleccionada');
    }

    try {
      const membership = await this.empresaUsuariosService.findActiveMembership(
        user.sub,
        user.empresaId,
      );

      if (!membership) {
        throw new Error('Inactive membership');
      }

      request.tenantScope = await this.tenantResolverService.resolveByEmpresaId(
        user.empresaId,
      );
      request.tenantMembership = Object.freeze({
        usuarioId: membership.usuarioId,
        empresaId: membership.empresaId,
        rol: membership.rol,
      });
      return true;
    } catch {
      delete request.tenantScope;
      delete request.tenantMembership;
      throw new ForbiddenException('Empresa no autorizada');
    }
  }
}
