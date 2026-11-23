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
      ipAddress: '192.0.2.1',
      userAgent: 'Old Browser',
      lastSeenAt: new Date('2026-01-01T00:00:00.000Z'),
      revokedByUsuarioId: null,
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

    const result = await service.create(usuarioId, {
      ipAddress: '203.0.113.10',
      userAgent: 'Test Browser',
    });

    expect(result.refreshToken).toBe(token);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId,
        refreshTokenHash: tokenHash,
        revokedAt: null,
        ipAddress: '203.0.113.10',
        userAgent: 'Test Browser',
        lastSeenAt: expect.any(Date),
        revokedByUsuarioId: null,
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

    await expect(
      service.rotate('presented-token', {
        ipAddress: '203.0.113.20',
        userAgent: 'New Browser',
      }),
    ).resolves.toEqual({
      session,
      usuario: session.usuario,
      refreshToken: 'rotated-token',
    });
    expect(session.refreshTokenHash).toBe('rotated-hash');
    expect(session.ipAddress).toBe('203.0.113.20');
    expect(session.userAgent).toBe('New Browser');
    expect(session.lastSeenAt.getTime()).toBeGreaterThan(
      new Date('2026-01-01T00:00:00.000Z').getTime(),
    );
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

  it('does not update lastSeenAt while validating a protected request', async () => {
    const session = sessionWith();
    const { builder } = queryBuilderReturning(session);
    const save = vi.fn();
    const repository = {
      createQueryBuilder: vi.fn().mockReturnValue(builder),
      save,
    } as unknown as Repository<AuthSession>;
    const service = new AuthSessionsService(
      repository,
      {} as DataSource,
      {} as RefreshTokenService,
      {} as ConfigService,
    );

    await expect(
      service.assertActive(sessionId, usuarioId),
    ).resolves.toBeUndefined();
    expect(save).not.toHaveBeenCalled();
    expect(session.lastSeenAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
  });

  it('lists only the safe projection in stable order and marks the current session', async () => {
    const current = Object.assign(sessionWith(), {
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      lastSeenAt: new Date('2026-01-02T00:00:00.000Z'),
      userAgent: 'Current Browser',
    });
    const select = vi.fn();
    const where = vi.fn();
    const andWhere = vi.fn();
    const orderBy = vi.fn();
    const addOrderBy = vi.fn();
    const take = vi.fn();
    const getMany = vi.fn().mockResolvedValue([current]);
    const builder = {
      select,
      where,
      andWhere,
      orderBy,
      addOrderBy,
      take,
      getMany,
    };
    for (const method of [select, where, andWhere, orderBy, addOrderBy, take]) {
      method.mockReturnValue(builder);
    }
    const repository = {
      createQueryBuilder: vi.fn().mockReturnValue(builder),
    } as unknown as Repository<AuthSession>;
    const service = new AuthSessionsService(
      repository,
      {} as DataSource,
      {} as RefreshTokenService,
      {} as ConfigService,
    );

    await expect(
      service.findOwned(usuarioId, sessionId, {
        revoked: false,
        limit: 50,
      }),
    ).resolves.toEqual([
      {
        id: sessionId,
        current: true,
        createdAt: current.createdAt,
        lastSeenAt: current.lastSeenAt,
        expiresAt: current.expiresAt,
        revokedAt: null,
        ipAddress: current.ipAddress,
        userAgent: 'Current Browser',
      },
    ]);
    expect(select).toHaveBeenCalledWith(
      expect.not.arrayContaining([
        'session.refreshTokenHash',
        'session.revokedByUsuarioId',
      ]),
    );
    expect(andWhere).toHaveBeenCalledWith('session.revokedAt IS NULL');
    expect(orderBy).toHaveBeenCalledWith('session.lastSeenAt', 'DESC');
    expect(addOrderBy).toHaveBeenCalledWith('session.id', 'DESC');
    expect(take).toHaveBeenCalledWith(50);
  });

  it('returns 404 for a session outside the authenticated user scope', async () => {
    const { builder } = queryBuilderReturning(null);
    const repository = {
      createQueryBuilder: vi.fn().mockReturnValue(builder),
    } as unknown as Repository<AuthSession>;
    const manager = {
      getRepository: vi.fn().mockReturnValue(repository),
    } as unknown as EntityManager;
    const service = new AuthSessionsService(
      {} as Repository<AuthSession>,
      {
        transaction: vi.fn((callback) => callback(manager)),
      } as unknown as DataSource,
      {} as RefreshTokenService,
      {} as ConfigService,
    );

    await expect(
      service.revokeOwned(sessionId, usuarioId, usuarioId),
    ).rejects.toThrow('Sesión no encontrada');
  });

  it('revokes every other active session in one transaction', async () => {
    const update = vi.fn();
    const set = vi.fn();
    const where = vi.fn();
    const andWhere = vi.fn();
    const execute = vi.fn().mockResolvedValue({ affected: 2 });
    const builder = { update, set, where, andWhere, execute };
    for (const method of [update, set, where, andWhere]) {
      method.mockReturnValue(builder);
    }
    const repository = {
      createQueryBuilder: vi.fn().mockReturnValue(builder),
    } as unknown as Repository<AuthSession>;
    const manager = {
      getRepository: vi.fn().mockReturnValue(repository),
    } as unknown as EntityManager;
    const transaction = vi.fn((callback) => callback(manager));
    const service = new AuthSessionsService(
      {} as Repository<AuthSession>,
      { transaction } as unknown as DataSource,
      {} as RefreshTokenService,
      {} as ConfigService,
    );

    await expect(service.revokeOthers(usuarioId, sessionId)).resolves.toBe(2);
    expect(set).toHaveBeenCalledWith({
      revokedAt: expect.any(Date),
      revokedByUsuarioId: usuarioId,
    });
    expect(where).toHaveBeenCalledWith('usuario_id = :usuarioId', {
      usuarioId,
    });
    expect(andWhere).toHaveBeenCalledWith('id <> :currentSessionId', {
      currentSessionId: sessionId,
    });
    expect(andWhere).toHaveBeenCalledWith('revoked_at IS NULL');
    expect(transaction).toHaveBeenCalledOnce();
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
    expect(session.revokedByUsuarioId).toBe(usuarioId);
    expect(save).toHaveBeenCalledWith(session);
  });
});
