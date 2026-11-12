import { ConfigService } from '@nestjs/config';
import {
  DataSource,
  EntityManager,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import { AuthSessionsService } from './auth-sessions.service.js';
import { AuthSession } from './entities/auth-session.entity.js';
import { RefreshTokenService } from './refresh-token.service.js';

describe('AuthSessionsService', () => {
  const usuarioId = '019a6f33-82b7-7a22-971b-6a8d7c5e4f30';
  const sessionId = '47ecf96a-8f2c-4e07-bd1f-93936f2cdb90';

  function queryBuilderReturning(session: AuthSession | null) {
    const getOne = vi.fn().mockResolvedValue(session);
    const builder = {
      innerJoin: vi.fn(),
      innerJoinAndSelect: vi.fn(),
      where: vi.fn(),
      andWhere: vi.fn(),
      setLock: vi.fn(),
      getOne,
    };

    for (const method of [
      builder.innerJoin,
      builder.innerJoinAndSelect,
      builder.where,
      builder.andWhere,
      builder.setLock,
    ]) {
      method.mockReturnValue(builder);
    }

    return {
      builder: builder as unknown as SelectQueryBuilder<AuthSession>,
      getOne,
    };
  }

  function sessionWith(options?: {
    expired?: boolean;
    revoked?: boolean;
    activeUser?: boolean;
  }) {
    const usuario = Object.assign(new Usuario(), {
      id: usuarioId,
      email: 'owner@example.com',
      activo: options?.activeUser ?? true,
    });

    return Object.assign(new AuthSession(), {
      id: sessionId,
      usuarioId,
      refreshTokenHash: 'old-hash',
      expiresAt: new Date(
        Date.now() + (options?.expired ? -3_600_000 : 3_600_000),
      ),
      revokedAt: options?.revoked ? new Date() : null,
      usuario,
    });
  }

  it('stores only the refresh token hash when creating a session', async () => {
    const token = 'sensitive-refresh-token';
    const tokenHash = 'a'.repeat(64);
    const create = vi.fn((input: Partial<AuthSession>) =>
      Object.assign(new AuthSession(), input),
    );
    const save = vi.fn().mockImplementation((session) => session);
    const repository = { create, save } as unknown as Repository<AuthSession>;
    const refreshTokenService = {
      issue: vi.fn().mockReturnValue({ token, hash: tokenHash }),
    } as unknown as RefreshTokenService;
    const configService = {
      getOrThrow: vi.fn().mockReturnValue('2592000'),
    } as unknown as ConfigService;
    const service = new AuthSessionsService(
      repository,
      {} as DataSource,
      refreshTokenService,
      configService,
    );

    const result = await service.create(usuarioId);

    expect(result.refreshToken).toBe(token);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId,
        refreshTokenHash: tokenHash,
        revokedAt: null,
      }),
    );
    expect(JSON.stringify(create.mock.calls[0][0])).not.toContain(token);
    expect(save).toHaveBeenCalledOnce();
  });

  it('rotates the hash atomically while keeping the same session', async () => {
    const session = sessionWith();
    const { builder } = queryBuilderReturning(session);
    const save = vi.fn().mockImplementation((value) => value);
    const repository = {
      createQueryBuilder: vi.fn().mockReturnValue(builder),
      save,
    } as unknown as Repository<AuthSession>;
    const manager = {
      getRepository: vi.fn().mockReturnValue(repository),
    } as unknown as EntityManager;
    const transaction = vi.fn((callback) => callback(manager));
    const dataSource = { transaction } as unknown as DataSource;
    const refreshTokenService = {
      hash: vi.fn().mockReturnValue('presented-hash'),
      issue: vi.fn().mockReturnValue({
        token: 'rotated-token',
        hash: 'rotated-hash',
      }),
    } as unknown as RefreshTokenService;
    const service = new AuthSessionsService(
      {} as Repository<AuthSession>,
      dataSource,
      refreshTokenService,
      {} as ConfigService,
    );

    await expect(service.rotate('presented-token')).resolves.toEqual({
      session,
      usuario: session.usuario,
      refreshToken: 'rotated-token',
    });
    expect(session.refreshTokenHash).toBe('rotated-hash');
    expect(save).toHaveBeenCalledWith(session);
    expect(transaction).toHaveBeenCalledOnce();
  });

  it.each([
    ['expired', { expired: true }],
    ['revoked', { revoked: true }],
    ['owned by an inactive user', { activeUser: false }],
  ])('rejects a session that is %s', async (_name, options) => {
    const session = sessionWith(options);
    const { builder } = queryBuilderReturning(session);
    const save = vi.fn();
    const repository = {
      createQueryBuilder: vi.fn().mockReturnValue(builder),
      save,
    } as unknown as Repository<AuthSession>;
    const manager = {
      getRepository: vi.fn().mockReturnValue(repository),
    } as unknown as EntityManager;
    const dataSource = {
      transaction: vi.fn((callback) => callback(manager)),
    } as unknown as DataSource;
    const refreshTokenService = {
      hash: vi.fn().mockReturnValue('presented-hash'),
    } as unknown as RefreshTokenService;
    const service = new AuthSessionsService(
      {} as Repository<AuthSession>,
      dataSource,
      refreshTokenService,
      {} as ConfigService,
    );

    await expect(service.rotate('presented-token')).rejects.toThrow(
      'Refresh token inválido',
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects access when the session is not active', async () => {
    const { builder } = queryBuilderReturning(null);
    const repository = {
      createQueryBuilder: vi.fn().mockReturnValue(builder),
    } as unknown as Repository<AuthSession>;
    const service = new AuthSessionsService(
      repository,
      {} as DataSource,
      {} as RefreshTokenService,
      {} as ConfigService,
    );

    await expect(service.assertActive(sessionId, usuarioId)).rejects.toThrow(
      'Token inválido',
    );
  });

  it('sets revokedAt on the current session', async () => {
    const session = sessionWith();
    const { builder } = queryBuilderReturning(session);
    const save = vi.fn().mockImplementation((value) => value);
    const repository = {
      createQueryBuilder: vi.fn().mockReturnValue(builder),
      save,
    } as unknown as Repository<AuthSession>;
    const manager = {
      getRepository: vi.fn().mockReturnValue(repository),
    } as unknown as EntityManager;
    const dataSource = {
      transaction: vi.fn((callback) => callback(manager)),
    } as unknown as DataSource;
    const service = new AuthSessionsService(
      {} as Repository<AuthSession>,
      dataSource,
      {} as RefreshTokenService,
      {} as ConfigService,
    );

    await service.revoke(sessionId, usuarioId);

    expect(session.revokedAt).toBeInstanceOf(Date);
    expect(save).toHaveBeenCalledWith(session);
  });
});
