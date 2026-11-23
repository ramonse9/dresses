import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { AuthSessionsService } from '../src/auth/auth-sessions.service.js';
import { AuthService } from '../src/auth/auth.service.js';
import { AuthSession } from '../src/auth/entities/auth-session.entity.js';
import { PasswordHashService } from '../src/auth/password-hash.service.js';
import { RefreshTokenService } from '../src/auth/refresh-token.service.js';
import type { AccessTokenPayload } from '../src/auth/types/access-token-payload.js';
import { Usuario } from '../src/usuarios/entities/usuario.entity.js';

describe('PostgreSQL auth sessions', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let usuariosRepository: Repository<Usuario>;
  let sessionsRepository: Repository<AuthSession>;
  let authService: AuthService;
  let authSessionsService: AuthSessionsService;
  let refreshTokenService: RefreshTokenService;
  let jwtService: JwtService;
  let usuario: Usuario;

  const email = `auth-integration-${process.pid}-${Date.now()}@example.com`;
  const password = 'integration-password';

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await moduleRef.init();

    dataSource = moduleRef.get(DataSource);
    usuariosRepository = dataSource.getRepository(Usuario);
    sessionsRepository = dataSource.getRepository(AuthSession);
    authService = moduleRef.get(AuthService);
    authSessionsService = moduleRef.get(AuthSessionsService);
    refreshTokenService = moduleRef.get(RefreshTokenService);
    jwtService = moduleRef.get(JwtService);

    const passwordHashService = moduleRef.get(PasswordHashService);
    usuario = await usuariosRepository.save(
      usuariosRepository.create({
        email,
        passwordHash: await passwordHashService.hashPassword(password),
        nombre: 'Auth Integration',
        activo: true,
      }),
    );
  });

  afterAll(async () => {
    if (usuario && dataSource?.isInitialized) {
      await usuariosRepository.delete({ id: usuario.id });
    }
    await moduleRef?.close();
  });

  it('stores only hashes, allows one concurrent rotation and revokes access', async () => {
    const loginMetadata = {
      ipAddress: '203.0.113.10',
      userAgent: 'Auth integration browser',
    };
    const login = await authService.login({ email, password }, loginMetadata);
    const loginPayload = await jwtService.verifyAsync<AccessTokenPayload>(
      login.accessToken,
    );
    const storedSession = await sessionsRepository
      .createQueryBuilder('session')
      .addSelect('session.refreshTokenHash')
      .where('session.id = :sessionId', { sessionId: loginPayload.sessionId })
      .getOneOrFail();

    expect(storedSession.refreshTokenHash).toBe(
      refreshTokenService.hash(login.refreshToken),
    );
    expect(storedSession.refreshTokenHash).not.toContain(login.refreshToken);
    expect(storedSession).toMatchObject(loginMetadata);
    expect(storedSession.lastSeenAt).toBeInstanceOf(Date);
    expect(storedSession.revokedByUsuarioId).toBeNull();
    expect(JSON.stringify(storedSession)).not.toMatch(
      /refreshTokenHash|sensitive-refresh-token|authorization|cookie/i,
    );

    const loginLastSeenAt = storedSession.lastSeenAt;
    await sessionsRepository.update(storedSession.id, {
      lastSeenAt: new Date(loginLastSeenAt.getTime() - 60_000),
    });

    const rotations = await Promise.allSettled([
      authService.refresh(login.refreshToken, {
        ipAddress: '2001:db8::10',
        userAgent: 'Rotated integration browser',
      }),
      authService.refresh(login.refreshToken, {
        ipAddress: '2001:db8::10',
        userAgent: 'Rotated integration browser',
      }),
    ]);
    const successfulRotations = rotations.filter(
      (result) => result.status === 'fulfilled',
    );
    const rejectedRotations = rotations.filter(
      (result) => result.status === 'rejected',
    );

    expect(successfulRotations).toHaveLength(1);
    expect(rejectedRotations).toHaveLength(1);

    const rotated = successfulRotations[0];
    if (rotated?.status !== 'fulfilled') {
      throw new Error('Expected one successful refresh rotation');
    }

    const rotatedPayload = await jwtService.verifyAsync<AccessTokenPayload>(
      rotated.value.accessToken,
    );
    expect(rotated.value.refreshToken).not.toBe(login.refreshToken);
    expect(rotatedPayload.sessionId).toBe(loginPayload.sessionId);

    const refreshedSession = await sessionsRepository.findOneByOrFail({
      id: loginPayload.sessionId,
    });
    expect(refreshedSession.ipAddress).toBe('2001:db8::10');
    expect(refreshedSession.userAgent).toBe('Rotated integration browser');
    expect(refreshedSession.lastSeenAt.getTime()).toBeGreaterThan(
      loginLastSeenAt.getTime() - 60_000,
    );

    await authService.logout(rotatedPayload);

    const revokedSession = await sessionsRepository.findOneByOrFail({
      id: loginPayload.sessionId,
    });
    expect(revokedSession.revokedByUsuarioId).toBe(usuario.id);

    await expect(
      authService.refresh(rotated.value.refreshToken),
    ).rejects.toThrow('Refresh token inválido');
    await expect(
      authSessionsService.assertActive(rotatedPayload.sessionId, usuario.id),
    ).rejects.toThrow('Token inválido');
  });

  it('rejects refresh when the owning user becomes inactive', async () => {
    const login = await authService.login({ email, password });
    usuario.activo = false;
    await usuariosRepository.save(usuario);

    await expect(authService.refresh(login.refreshToken)).rejects.toThrow(
      'Refresh token inválido',
    );
  });
});
