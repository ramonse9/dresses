import { getMetadataArgsStorage } from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity.js';
import { AuthSession } from './auth-session.entity.js';

describe('AuthSession', () => {
  it('never serializes the refresh token hash', () => {
    const session = Object.assign(new AuthSession(), {
      id: '47ecf96a-8f2c-4e07-bd1f-93936f2cdb90',
      usuarioId: '019a6f33-82b7-7a22-971b-6a8d7c5e4f30',
      refreshTokenHash: 'a'.repeat(64),
      expiresAt: new Date('2026-12-12T00:00:00.000Z'),
      revokedAt: null,
      ipAddress: '203.0.113.10',
      userAgent: 'Browser/1.0',
      lastSeenAt: new Date('2026-11-12T01:00:00.000Z'),
      revokedByUsuarioId: null,
      createdAt: new Date('2026-11-12T00:00:00.000Z'),
      updatedAt: new Date('2026-11-12T00:00:00.000Z'),
    });

    const serialized = session.toJSON();

    expect(serialized).not.toHaveProperty('refreshTokenHash');
    expect(JSON.stringify(serialized)).not.toContain(session.refreshTokenHash);
    expect(serialized).toMatchObject({
      ipAddress: '203.0.113.10',
      userAgent: 'Browser/1.0',
      revokedByUsuarioId: null,
    });
  });

  it('defines safe metadata columns, indexes and the revocation actor relation', () => {
    const metadata = getMetadataArgsStorage();
    const columns = metadata.columns.filter(
      (column) => column.target === AuthSession,
    );
    const byName = (propertyName: string) =>
      columns.find((column) => column.propertyName === propertyName)?.options;

    expect(byName('refreshTokenHash')).toMatchObject({ select: false });
    expect(byName('ipAddress')).toMatchObject({ type: 'inet', nullable: true });
    expect(byName('userAgent')).toMatchObject({
      type: 'varchar',
      length: 512,
      nullable: true,
    });
    expect(byName('lastSeenAt')).toMatchObject({
      type: 'timestamptz',
      default: expect.any(Function),
    });
    expect(byName('revokedByUsuarioId')).toMatchObject({
      type: 'uuid',
      nullable: true,
    });

    const indexes = metadata.indices.filter(
      (index) => index.target === AuthSession,
    );
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'IDX_auth_sessions_usuario_revoked_at',
          columns: ['usuarioId', 'revokedAt'],
        }),
        expect.objectContaining({
          name: 'IDX_auth_sessions_usuario_last_seen_at',
          columns: ['usuarioId', 'lastSeenAt'],
        }),
      ]),
    );

    const revokedBy = metadata.relations.find(
      (relation) =>
        relation.target === AuthSession &&
        relation.propertyName === 'revokedByUsuario',
    );
    expect(revokedBy).toMatchObject({
      relationType: 'many-to-one',
      options: { nullable: true, onDelete: 'SET NULL' },
    });
    expect(
      metadata.relations.find(
        (relation) =>
          relation.target === Usuario &&
          relation.propertyName === 'authSessionsRevocadas',
      )?.relationType,
    ).toBe('one-to-many');
  });
});
