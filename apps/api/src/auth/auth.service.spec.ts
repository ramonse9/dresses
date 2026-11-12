import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import { AuthSessionsService } from './auth-sessions.service.js';
import { AuthService } from './auth.service.js';
import { AuthSession } from './entities/auth-session.entity.js';
import { PasswordHashService } from './password-hash.service.js';

describe('AuthService', () => {
  const sessionId = '47ecf96a-8f2c-4e07-bd1f-93936f2cdb90';
  const activeUser = Object.assign(new Usuario(), {
    id: '019a6f33-82b7-7a22-971b-6a8d7c5e4f30',
    email: 'owner@example.com',
    passwordHash: '$argon2id$stored-hash',
    activo: true,
  });

  function createService(options?: {
    user?: Usuario | null;
    passwordMatches?: boolean;
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

    return {
      service: new AuthService(
        usuariosService,
        passwordHashService,
        jwtService,
        configService,
        authSessionsService,
      ),
      findByEmailForAuthentication,
      verifyPassword,
      signAsync,
      createSession,
      rotate,
      revoke,
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
