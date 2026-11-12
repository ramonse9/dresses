import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import { AuthService } from './auth.service.js';
import { PasswordHashService } from './password-hash.service.js';

describe('AuthService', () => {
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

    return {
      service: new AuthService(
        usuariosService,
        passwordHashService,
        jwtService,
        configService,
      ),
      findByEmailForAuthentication,
      verifyPassword,
      signAsync,
    };
  }

  it('returns a short-lived token with only identity and session claims', async () => {
    const { service, signAsync } = createService();

    await expect(
      service.login({ email: activeUser.email, password: 'correct-password' }),
    ).resolves.toEqual({
      accessToken: 'signed.jwt.token',
      tokenType: 'Bearer',
      expiresIn: 900,
    });

    expect(signAsync).toHaveBeenCalledOnce();
    const payload = signAsync.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      sub: activeUser.id,
      email: activeUser.email,
      sessionId: expect.any(String),
    });
    expect(Object.keys(payload).sort()).toEqual(['email', 'sessionId', 'sub']);
    expect(payload).not.toHaveProperty('schemaName');
  });

  it('returns a generic error for an incorrect password', async () => {
    const { service } = createService({ passwordMatches: false });

    await expect(
      service.login({
        email: activeUser.email,
        password: 'incorrect-password',
      }),
    ).rejects.toThrow('Credenciales inválidas');
  });

  it('returns the same generic error for an inactive user', async () => {
    const { service, verifyPassword } = createService({
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
  });

  it('performs password verification even when the user does not exist', async () => {
    const { service, verifyPassword } = createService({ user: null });

    await expect(
      service.login({ email: 'missing@example.com', password: 'any-password' }),
    ).rejects.toThrow('Credenciales inválidas');
    expect(verifyPassword).toHaveBeenCalledWith('any-password', undefined);
  });
});
