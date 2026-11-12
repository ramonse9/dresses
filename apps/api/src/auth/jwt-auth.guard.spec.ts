import { ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EmpresaUsuarioRol } from '../usuarios/entities/empresa-usuario.entity.js';
import { AuthSessionsService } from './auth-sessions.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

describe('JwtAuthGuard', () => {
  const validPayload = {
    sub: '019a6f33-82b7-7a22-971b-6a8d7c5e4f30',
    email: 'owner@example.com',
    sessionId: '47ecf96a-8f2c-4e07-bd1f-93936f2cdb90',
  };

  function contextWithAuthorization(authorization?: string) {
    const request = { headers: { authorization } };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return { context, request };
  }

  function activeSessionsService() {
    const assertActive = vi.fn().mockResolvedValue(undefined);
    return {
      service: { assertActive } as unknown as AuthSessionsService,
      assertActive,
    };
  }

  it('validates a bearer token and attaches its safe payload', async () => {
    const jwtService = {
      verifyAsync: vi.fn().mockResolvedValue(validPayload),
    } as unknown as JwtService;
    const { service: authSessionsService, assertActive } =
      activeSessionsService();
    const guard = new JwtAuthGuard(jwtService, authSessionsService);
    const { context, request } = contextWithAuthorization('Bearer valid-token');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request).toHaveProperty('user', validPayload);
    expect(assertActive).toHaveBeenCalledWith(
      validPayload.sessionId,
      validPayload.sub,
    );
  });

  it('rejects an invalid token with a generic error', async () => {
    const jwtService = {
      verifyAsync: vi.fn().mockRejectedValue(new Error('invalid signature')),
    } as unknown as JwtService;
    const guard = new JwtAuthGuard(jwtService, activeSessionsService().service);
    const { context } = contextWithAuthorization('Bearer invalid-token');

    await expect(guard.canActivate(context)).rejects.toThrow('Token inválido');
  });

  it('rejects a missing bearer token', async () => {
    const guard = new JwtAuthGuard(
      {} as JwtService,
      activeSessionsService().service,
    );
    const { context } = contextWithAuthorization();

    await expect(guard.canActivate(context)).rejects.toThrow('Token inválido');
  });

  it('rejects a valid JWT when its session is no longer active', async () => {
    const jwtService = {
      verifyAsync: vi.fn().mockResolvedValue(validPayload),
    } as unknown as JwtService;
    const authSessionsService = {
      assertActive: vi.fn().mockRejectedValue(new Error('revoked')),
    } as unknown as AuthSessionsService;
    const guard = new JwtAuthGuard(jwtService, authSessionsService);
    const { context } = contextWithAuthorization('Bearer valid-token');

    await expect(guard.canActivate(context)).rejects.toThrow('Token inválido');
  });

  it('accepts and preserves a validated empresa context', async () => {
    const selectedPayload = {
      ...validPayload,
      empresaId: 'a18c2a56-d33f-4d88-a8e7-42931121e295',
      rol: EmpresaUsuarioRol.OWNER,
    };
    const jwtService = {
      verifyAsync: vi.fn().mockResolvedValue(selectedPayload),
    } as unknown as JwtService;
    const guard = new JwtAuthGuard(jwtService, activeSessionsService().service);
    const { context, request } = contextWithAuthorization('Bearer valid-token');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request).toHaveProperty('user', selectedPayload);
  });

  it.each([
    {
      ...validPayload,
      empresaId: 'a18c2a56-d33f-4d88-a8e7-42931121e295',
    },
    { ...validPayload, rol: EmpresaUsuarioRol.OWNER },
    {
      ...validPayload,
      empresaId: 'a18c2a56-d33f-4d88-a8e7-42931121e295',
      rol: 'ADMIN',
    },
    { ...validPayload, schemaName: 'tenant_internal' },
  ])('rejects malformed or schema-bearing empresa claims', async (payload) => {
    const jwtService = {
      verifyAsync: vi.fn().mockResolvedValue(payload),
    } as unknown as JwtService;
    const guard = new JwtAuthGuard(jwtService, activeSessionsService().service);
    const { context } = contextWithAuthorization('Bearer invalid-token');

    await expect(guard.canActivate(context)).rejects.toThrow('Token inválido');
  });
});
