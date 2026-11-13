import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import type { TenantScope } from '../tenancy/tenant-scope.js';
import { EmpresaUsuarioRol } from '../usuarios/entities/empresa-usuario.entity.js';
import { TenantScopeCleanupInterceptor } from './tenant-scope-cleanup.interceptor.js';

describe('TenantScopeCleanupInterceptor', () => {
  const tenantScope = {
    empresaId: 'a18c2a56-d33f-4d88-a8e7-42931121e295',
    empresaSlug: 'atelier-norte',
    schemaName: 'tenant_a18c2a56d33f4d88a8e742931121e295',
  } as TenantScope;

  function buildContext() {
    const request: {
      tenantScope?: TenantScope;
      tenantMembership?: {
        usuarioId: string;
        empresaId: string;
        rol: EmpresaUsuarioRol;
      };
    } = {
      tenantScope,
      tenantMembership: {
        usuarioId: '019a6f33-82b7-7a22-971b-6a8d7c5e4f30',
        empresaId: tenantScope.empresaId,
        rol: EmpresaUsuarioRol.OWNER,
      },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return { context, request };
  }

  it('clears the request-local scope after a successful response', async () => {
    const { context, request } = buildContext();
    const interceptor = new TenantScopeCleanupInterceptor();
    const next = { handle: () => of('ok') } as CallHandler;

    await expect(
      lastValueFrom(interceptor.intercept(context, next)),
    ).resolves.toBe('ok');
    expect(request).not.toHaveProperty('tenantScope');
    expect(request).not.toHaveProperty('tenantMembership');
  });

  it('clears the request-local scope after a failed response', async () => {
    const { context, request } = buildContext();
    const interceptor = new TenantScopeCleanupInterceptor();
    const next = {
      handle: () => throwError(() => new Error('handler failed')),
    } as CallHandler;

    await expect(
      lastValueFrom(interceptor.intercept(context, next)),
    ).rejects.toThrow('handler failed');
    expect(request).not.toHaveProperty('tenantScope');
    expect(request).not.toHaveProperty('tenantMembership');
  });
});
