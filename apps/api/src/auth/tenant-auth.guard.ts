import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { TenantResolverService } from '../tenancy/tenant-resolver.service.js';
import type { TenantScope } from '../tenancy/tenant-scope.js';
import type { AuthenticatedRequest } from './jwt-auth.guard.js';

export interface TenantAuthenticatedRequest extends AuthenticatedRequest {
  tenantScope?: TenantScope;
}

@Injectable()
export class TenantAuthGuard implements CanActivate {
  constructor(private readonly tenantResolverService: TenantResolverService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<TenantAuthenticatedRequest>();
    const user = request.user;

    if (!user || !('empresaId' in user)) {
      throw new ForbiddenException('Empresa no seleccionada');
    }

    try {
      request.tenantScope = await this.tenantResolverService.resolveByEmpresaId(
        user.empresaId,
      );
      return true;
    } catch {
      throw new ForbiddenException('Empresa no autorizada');
    }
  }
}
