import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Empresa } from '../empresas/entities/empresa.entity.js';
import { TenantResolverService } from '../tenancy/tenant-resolver.service.js';
import { EmpresaUsuariosService } from '../usuarios/empresa-usuarios.service.js';
import {
  EmpresaUsuario,
  EmpresaUsuarioRol,
} from '../usuarios/entities/empresa-usuario.entity.js';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import { AuthSessionsService } from './auth-sessions.service.js';
import { AuthService } from './auth.service.js';
import { AuthSession } from './entities/auth-session.entity.js';
import { PasswordHashService } from './password-hash.service.js';

describe('AuthService', () => {
  const sessionId = '47ecf96a-8f2c-4e07-bd1f-93936f2cdb90';
  const empresaId = 'a18c2a56-d33f-4d88-a8e7-42931121e295';
  const activeUser = Object.assign(new Usuario(), {
    id: '019a6f33-82b7-7a22-971b-6a8d7c5e4f30',
    email: 'owner@example.com',
    passwordHash: '$argon2id$stored-hash',
    activo: true,
  });

  function createService(options?: {
    user?: Usuario | null;
    passwordMatches?: boolean;
    membership?: EmpresaUsuario | null;
    memberships?: EmpresaUsuario[];
  }) {
    const findByEmailForAuthentication = vi
      .fn()
      .mockResolvedValue(
        options?.user === undefined ? activeUser : options.user,
      );
    const verifyPassword = vi
      .fn()
      .mockResolvedValue(options?.passwordMatches ?? true);
    const signAsync = vi.fn().mockResolvedValue('signed.jwt.token');
    const session = Object.assign(new AuthSession(), {
      id: sessionId,
      usuarioId: activeUser.id,
      usuario: activeUser,
    });
    const createSession = vi.fn().mockResolvedValue({
      session,
      refreshToken: 'new-refresh-token',
    });
    const rotate = vi.fn().mockResolvedValue({
      session,
      usuario: activeUser,
      refreshToken: 'rotated-refresh-token',
    });
    const revoke = vi.fn().mockResolvedValue(undefined);
    const empresa = Object.assign(new Empresa(), {
      id: empresaId,
      nombre: 'Atelier Norte',
      slug: 'atelier-norte',
      schemaName: 'tenant_a18c2a56d33f4d88a8e742931121e295',
      activo: true,
    });
    const membership = Object.assign(new EmpresaUsuario(), {
      id: 'b28c2a56-d33f-4d88-a8e7-42931121e295',
      usuarioId: activeUser.id,
      empresaId,
      rol: EmpresaUsuarioRol.OWNER,
      activo: true,
      empresa,
    });
    const findActiveByUsuarioId = vi
      .fn()
      .mockResolvedValue(options?.memberships ?? [membership]);
    const findActiveMembership = vi
      .fn()
      .mockResolvedValue(
        options?.membership === undefined ? membership : options.membership,
      );
    const resolveByEmpresaId = vi.fn().mockResolvedValue({
      empresaId,
      empresaSlug: empresa.slug,
      schemaName: empresa.schemaName,
    });
    const usuariosService = {
      findByEmailForAuthentication,
    } as unknown as UsuariosService;
    const passwordHashService = {
      verifyPassword,
    } as unknown as PasswordHashService;
    const jwtService = {
      signAsync,
    } as unknown as JwtService;
    const configService = {
      getOrThrow: vi.fn().mockReturnValue('900'),
    } as unknown as ConfigService;
    const authSessionsService = {
      create: createSession,
      rotate,
      revoke,
    } as unknown as AuthSessionsService;
    const empresaUsuariosService = {
      findActiveByUsuarioId,
      findActiveMembership,
    } as unknown as EmpresaUsuariosService;
    const tenantResolverService = {
      resolveByEmpresaId,
    } as unknown as TenantResolverService;

    return {
      service: new AuthService(
        usuariosService,
        passwordHashService,
        jwtService,
        configService,
        authSessionsService,
        empresaUsuariosService,
        tenantResolverService,
      ),
      findByEmailForAuthentication,
      verifyPassword,
      signAsync,
      createSession,
      rotate,
      revoke,
      findActiveByUsuarioId,
      findActiveMembership,
      resolveByEmpresaId,
      membership,
    };
  }

  it('returns a short-lived token with only identity and session claims', async () => {
    const { service, signAsync, createSession } = createService();

    await expect(
      service.login({ email: activeUser.email, password: 'correct-password' }),
    ).resolves.toEqual({
      accessToken: 'signed.jwt.token',
      refreshToken: 'new-refresh-token',
      tokenType: 'Bearer',
      expiresIn: 900,
    });

    expect(signAsync).toHaveBeenCalledOnce();
    expect(createSession).toHaveBeenCalledWith(activeUser.id);
    const payload = signAsync.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      sub: activeUser.id,
      email: activeUser.email,
      sessionId,
    });
    expect(Object.keys(payload).sort()).toEqual(['email', 'sessionId', 'sub']);
    expect(payload).not.toHaveProperty('schemaName');
  });

  it('rotates the refresh token and issues a new access token', async () => {
    const { service, rotate, signAsync } = createService();

    await expect(
      service.refresh({ refreshToken: 'current-refresh-token' }),
    ).resolves.toEqual({
      accessToken: 'signed.jwt.token',
      refreshToken: 'rotated-refresh-token',
      tokenType: 'Bearer',
      expiresIn: 900,
    });
    expect(rotate).toHaveBeenCalledWith('current-refresh-token');
    expect(signAsync).toHaveBeenCalledWith({
      sub: activeUser.id,
      email: activeUser.email,
      sessionId,
    });
  });

  it('revokes the current authenticated session on logout', async () => {
    const { service, revoke } = createService();

    await service.logout({
      sub: activeUser.id,
      email: activeUser.email,
      sessionId,
    });

    expect(revoke).toHaveBeenCalledWith(sessionId, activeUser.id);
  });

  it('lists multiple active empresas without exposing schemaName', async () => {
    const secondEmpresa = Object.assign(new Empresa(), {
      id: 'c38c2a56-d33f-4d88-a8e7-42931121e295',
      nombre: 'Atelier Sur',
      slug: 'atelier-sur',
      schemaName: 'tenant_c38c2a56d33f4d88a8e742931121e295',
      activo: true,
    });
    const secondMembership = Object.assign(new EmpresaUsuario(), {
      usuarioId: activeUser.id,
      empresaId: secondEmpresa.id,
      rol: EmpresaUsuarioRol.EMPLOYEE,
      activo: true,
      empresa: secondEmpresa,
    });
    const defaults = createService();
    const { service } = createService({
      memberships: [defaults.membership, secondMembership],
    });

    const empresas = await service.listEmpresas({
      sub: activeUser.id,
      email: activeUser.email,
      sessionId,
    });

    expect(empresas).toEqual([
      {
        id: empresaId,
        nombre: 'Atelier Norte',
        slug: 'atelier-norte',
        rol: EmpresaUsuarioRol.OWNER,
      },
      {
        id: secondEmpresa.id,
        nombre: 'Atelier Sur',
        slug: 'atelier-sur',
        rol: EmpresaUsuarioRol.EMPLOYEE,
      },
    ]);
    expect(JSON.stringify(empresas)).not.toContain('schemaName');
    expect(JSON.stringify(empresas)).not.toContain('tenant_');
  });

  it('selects an authorized empresa and signs only its public context', async () => {
    const { service, signAsync, findActiveMembership, resolveByEmpresaId } =
      createService();
    const user = {
      sub: activeUser.id,
      email: activeUser.email,
      sessionId,
    };

    await expect(service.selectEmpresa(user, { empresaId })).resolves.toEqual({
      accessToken: 'signed.jwt.token',
      tokenType: 'Bearer',
      expiresIn: 900,
    });
    expect(findActiveMembership).toHaveBeenCalledWith(activeUser.id, empresaId);
    expect(resolveByEmpresaId).toHaveBeenCalledWith(empresaId);
    expect(signAsync).toHaveBeenCalledWith({
      sub: activeUser.id,
      email: activeUser.email,
      sessionId,
      empresaId,
      rol: EmpresaUsuarioRol.OWNER,
    });
    expect(signAsync.mock.calls[0][0]).not.toHaveProperty('schemaName');
  });

  it('rejects selecting an empresa without membership', async () => {
    const { service, signAsync, resolveByEmpresaId } = createService({
      membership: null,
    });

    await expect(
      service.selectEmpresa(
        {
          sub: activeUser.id,
          email: activeUser.email,
          sessionId,
        },
        { empresaId },
      ),
    ).rejects.toThrow('No tienes acceso a esta empresa');
    expect(resolveByEmpresaId).not.toHaveBeenCalled();
    expect(signAsync).not.toHaveBeenCalled();
  });

  it('returns a generic error for an incorrect password', async () => {
    const { service, createSession } = createService({
      passwordMatches: false,
    });

    await expect(
      service.login({
        email: activeUser.email,
        password: 'incorrect-password',
      }),
    ).rejects.toThrow('Credenciales inválidas');
    expect(createSession).not.toHaveBeenCalled();
  });

  it('returns the same generic error for an inactive user', async () => {
    const { service, verifyPassword, createSession } = createService({
      user: Object.assign(new Usuario(), {
        id: activeUser.id,
        email: activeUser.email,
        passwordHash: activeUser.passwordHash,
        activo: false,
      }),
    });

    await expect(
      service.login({ email: activeUser.email, password: 'correct-password' }),
    ).rejects.toThrow('Credenciales inválidas');
    expect(verifyPassword).toHaveBeenCalledOnce();
    expect(createSession).not.toHaveBeenCalled();
  });

  it('performs password verification even when the user does not exist', async () => {
    const { service, verifyPassword } = createService({ user: null });

    await expect(
      service.login({ email: 'missing@example.com', password: 'any-password' }),
    ).rejects.toThrow('Credenciales inválidas');
    expect(verifyPassword).toHaveBeenCalledWith('any-password', undefined);
  });
});
