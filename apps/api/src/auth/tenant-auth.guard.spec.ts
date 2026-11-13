import { ExecutionContext } from '@nestjs/common';
import { TenantResolverService } from '../tenancy/tenant-resolver.service.js';
import type { TenantScope } from '../tenancy/tenant-scope.js';
import { EmpresaUsuariosService } from '../usuarios/empresa-usuarios.service.js';
import { EmpresaUsuario } from '../usuarios/entities/empresa-usuario.entity.js';
import { EmpresaUsuarioRol } from '../usuarios/entities/empresa-usuario.entity.js';
import { TenantAuthGuard } from './tenant-auth.guard.js';

describe('TenantAuthGuard', () => {
  const tokenEmpresaId = 'a18c2a56-d33f-4d88-a8e7-42931121e295';
  const tenantScope = Object.freeze({
    empresaId: tokenEmpresaId,
    empresaSlug: 'atelier-norte',
    schemaName: 'tenant_a18c2a56d33f4d88a8e742931121e295',
  }) as TenantScope;
  const membership = Object.assign(new EmpresaUsuario(), {
    usuarioId: '019a6f33-82b7-7a22-971b-6a8d7c5e4f30',
    empresaId: tokenEmpresaId,
    rol: EmpresaUsuarioRol.EMPLOYEE,
    activo: true,
  });

  function buildContext(user: Record<string, unknown>) {
    const request = {
      user,
      headers: {
        'x-empresa-id': 'b28c2a56-d33f-4d88-a8e7-42931121e295',
        'x-schema-name': 'tenant_untrusted',
      },
      params: { empresaId: 'b28c2a56-d33f-4d88-a8e7-42931121e295' },
      query: { schemaName: 'tenant_untrusted' },
      body: {
        empresaId: 'b28c2a56-d33f-4d88-a8e7-42931121e295',
        schemaName: 'tenant_untrusted',
      },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return { context, request };
  }

  it('resolves exclusively the empresaId from the verified JWT payload', async () => {
    const resolveByEmpresaId = vi.fn().mockResolvedValue(tenantScope);
    const tenantResolverService = {
      resolveByEmpresaId,
    } as unknown as TenantResolverService;
    const findActiveMembership = vi.fn().mockResolvedValue(membership);
    const guard = new TenantAuthGuard(tenantResolverService, {
      findActiveMembership,
    } as unknown as EmpresaUsuariosService);
    const { context, request } = buildContext({
      sub: '019a6f33-82b7-7a22-971b-6a8d7c5e4f30',
      email: 'owner@example.com',
      sessionId: '47ecf96a-8f2c-4e07-bd1f-93936f2cdb90',
      empresaId: tokenEmpresaId,
      rol: EmpresaUsuarioRol.OWNER,
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(resolveByEmpresaId).toHaveBeenCalledWith(tokenEmpresaId);
    expect(findActiveMembership).toHaveBeenCalledWith(
      '019a6f33-82b7-7a22-971b-6a8d7c5e4f30',
      tokenEmpresaId,
    );
    expect(request).toHaveProperty('tenantScope', tenantScope);
    expect(request).toHaveProperty('tenantMembership', {
      usuarioId: membership.usuarioId,
      empresaId: membership.empresaId,
      rol: EmpresaUsuarioRol.EMPLOYEE,
    });
  });

  it('rejects an access token without a selected empresa', async () => {
    const resolveByEmpresaId = vi.fn();
    const guard = new TenantAuthGuard(
      {
        resolveByEmpresaId,
      } as unknown as TenantResolverService,
      {
        findActiveMembership: vi.fn(),
      } as unknown as EmpresaUsuariosService,
    );
    const { context } = buildContext({
      sub: '019a6f33-82b7-7a22-971b-6a8d7c5e4f30',
      email: 'owner@example.com',
      sessionId: '47ecf96a-8f2c-4e07-bd1f-93936f2cdb90',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Empresa no seleccionada',
    );
    expect(resolveByEmpresaId).not.toHaveBeenCalled();
  });

  it('does not expose resolver errors or retain an invalid scope', async () => {
    const guard = new TenantAuthGuard(
      {
        resolveByEmpresaId: vi.fn().mockRejectedValue(new Error('not found')),
      } as unknown as TenantResolverService,
      {
        findActiveMembership: vi.fn().mockResolvedValue(membership),
      } as unknown as EmpresaUsuariosService,
    );
    const { context, request } = buildContext({
      sub: '019a6f33-82b7-7a22-971b-6a8d7c5e4f30',
      email: 'owner@example.com',
      sessionId: '47ecf96a-8f2c-4e07-bd1f-93936f2cdb90',
      empresaId: tokenEmpresaId,
      rol: EmpresaUsuarioRol.OWNER,
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Empresa no autorizada',
    );
    expect(request).not.toHaveProperty('tenantScope');
    expect(request).not.toHaveProperty('tenantMembership');
  });

  it('rejects an inactive membership before resolving a tenant', async () => {
    const resolveByEmpresaId = vi.fn();
    const findActiveMembership = vi.fn().mockResolvedValue(null);
    const guard = new TenantAuthGuard(
      { resolveByEmpresaId } as unknown as TenantResolverService,
      { findActiveMembership } as unknown as EmpresaUsuariosService,
    );
    const { context, request } = buildContext({
      sub: membership.usuarioId,
      email: 'owner@example.com',
      sessionId: '47ecf96a-8f2c-4e07-bd1f-93936f2cdb90',
      empresaId: tokenEmpresaId,
      rol: EmpresaUsuarioRol.OWNER,
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Empresa no autorizada',
    );
    expect(findActiveMembership).toHaveBeenCalledWith(
      membership.usuarioId,
      tokenEmpresaId,
    );
    expect(resolveByEmpresaId).not.toHaveBeenCalled();
    expect(request).not.toHaveProperty('tenantScope');
    expect(request).not.toHaveProperty('tenantMembership');
  });
});
