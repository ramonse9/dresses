import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EmpresaUsuarioRol } from '../usuarios/entities/empresa-usuario.entity.js';
import { ROLES_METADATA_KEY, Roles } from './roles.decorator.js';
import { RolesGuard } from './roles.guard.js';

describe('Roles authorization', () => {
  class TestController {
    @Roles(EmpresaUsuarioRol.OWNER)
    update(this: void) {}
  }

  function buildContext(role?: EmpresaUsuarioRol): ExecutionContext {
    const request = role
      ? {
          tenantMembership: {
            usuarioId: '019a6f33-82b7-7a22-971b-6a8d7c5e4f30',
            empresaId: 'a18c2a56-d33f-4d88-a8e7-42931121e295',
            rol: role,
          },
        }
      : {};

    return {
      getHandler: () => TestController.prototype.update,
      getClass: () => TestController,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  it('stores the required roles as metadata', () => {
    expect(
      Reflect.getMetadata(ROLES_METADATA_KEY, TestController.prototype.update),
    ).toEqual([EmpresaUsuarioRol.OWNER]);
  });

  it('allows a role obtained from the verified membership', () => {
    const guard = new RolesGuard(new Reflector());

    expect(guard.canActivate(buildContext(EmpresaUsuarioRol.OWNER))).toBe(true);
  });

  it('returns 403 for an authenticated role without permission', () => {
    const guard = new RolesGuard(new Reflector());

    expect(() =>
      guard.canActivate(buildContext(EmpresaUsuarioRol.EMPLOYEE)),
    ).toThrow('No tienes permisos para esta operación');
  });

  it('returns 403 when no verified membership is attached', () => {
    const guard = new RolesGuard(new Reflector());

    expect(() => guard.canActivate(buildContext())).toThrow(
      'No tienes permisos para esta operación',
    );
  });
});
