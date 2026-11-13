import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { EmpresaUsuarioRol } from '../usuarios/entities/empresa-usuario.entity.js';
import { ROLES_METADATA_KEY } from './roles.decorator.js';
import type { TenantAuthenticatedRequest } from './tenant-auth.guard.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<EmpresaUsuarioRol[]>(
      ROLES_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length) {
      return true;
    }

    const membership = context
      .switchToHttp()
      .getRequest<TenantAuthenticatedRequest>().tenantMembership;

    if (!membership || !requiredRoles.includes(membership.rol)) {
      throw new ForbiddenException('No tienes permisos para esta operación');
    }

    return true;
  }
}
