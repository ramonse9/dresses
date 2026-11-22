import { getMetadataArgsStorage } from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity.js';
import {
  PasswordResetToken,
  PasswordResetTokenEstado,
} from './password-reset-token.entity.js';

describe('PasswordResetToken', () => {
  it('defines the token only in public with hidden fixed-length hashes', () => {
    const metadata = getMetadataArgsStorage();
    const table = metadata.tables.find(
      (entry) => entry.target === PasswordResetToken,
    );
    const columns = metadata.columns.filter(
      (column) => column.target === PasswordResetToken,
    );
    const byName = (propertyName: string) =>
      columns.find((column) => column.propertyName === propertyName)?.options;

    expect(table).toMatchObject({
      name: 'password_reset_tokens',
      schema: 'public',
    });
    expect(byName('usuarioId')).toMatchObject({
      name: 'usuario_id',
      type: 'uuid',
    });
    expect(byName('tokenHash')).toMatchObject({
      name: 'token_hash',
      type: 'varchar',
      length: 64,
      select: false,
    });
    expect(byName('expiresAt')).toMatchObject({ type: 'timestamptz' });
    expect(byName('usedAt')).toMatchObject({ nullable: true });
    expect(byName('revokedAt')).toMatchObject({ nullable: true });
  });

  it('declares the cascading Usuario relation and its inverse', () => {
    const relations = getMetadataArgsStorage().relations;
    const relation = (target: object, propertyName: string) =>
      relations.find(
        (entry) =>
          entry.target === target && entry.propertyName === propertyName,
      );

    expect(relation(PasswordResetToken, 'usuario')).toMatchObject({
      relationType: 'many-to-one',
      options: { nullable: false, onDelete: 'CASCADE' },
    });
    expect(relation(Usuario, 'passwordResetTokens')?.relationType).toBe(
      'one-to-many',
    );
  });

  it('declares lookup, uniqueness and pending-token indexes', () => {
    const indexes = getMetadataArgsStorage().indices.filter(
      (index) => index.target === PasswordResetToken,
    );

    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'IDX_password_reset_tokens_usuario_created_at',
          columns: ['usuarioId', 'createdAt'],
        }),
        expect.objectContaining({
          name: 'IDX_password_reset_tokens_expires_at',
          columns: ['expiresAt'],
        }),
        expect.objectContaining({
          name: 'UQ_password_reset_tokens_token_hash',
          columns: ['tokenHash'],
          unique: true,
        }),
        expect.objectContaining({
          name: 'UQ_password_reset_tokens_pending_usuario',
          columns: ['usuarioId'],
          unique: true,
          where: '"used_at" IS NULL AND "revoked_at" IS NULL',
        }),
        expect.objectContaining({
          name: 'IDX_password_reset_tokens_pending',
          columns: ['usuarioId', 'expiresAt'],
          where: '"used_at" IS NULL AND "revoked_at" IS NULL',
        }),
      ]),
    );

    expect(
      getMetadataArgsStorage().checks.find(
        (check) =>
          check.target === PasswordResetToken &&
          check.name === 'CHK_password_reset_tokens_token_hash',
      ),
    ).toBeDefined();
  });

  it('derives pending, used, revoked and expired states', () => {
    const now = new Date('2026-12-01T12:00:00.000Z');
    const token = Object.assign(new PasswordResetToken(), {
      usedAt: null,
      revokedAt: null,
      expiresAt: new Date('2026-12-01T13:00:00.000Z'),
    });

    expect(token.getEstado(now)).toBe(PasswordResetTokenEstado.PENDIENTE);
    expect(token.isUsable(true, now)).toBe(true);
    expect(token.isUsable(false, now)).toBe(false);

    token.revokedAt = now;
    expect(token.getEstado(now)).toBe(PasswordResetTokenEstado.REVOCADO);
    token.revokedAt = null;
    token.usedAt = now;
    expect(token.getEstado(now)).toBe(PasswordResetTokenEstado.USADO);
    token.usedAt = null;
    token.expiresAt = now;
    expect(token.getEstado(now)).toBe(PasswordResetTokenEstado.EXPIRADO);
  });

  it('never serializes token hashes or relations', () => {
    const token = Object.assign(new PasswordResetToken(), {
      id: '1b31f43c-5c79-48fc-b79f-109905b62ef0',
      usuarioId: 'a18c2a56-d33f-4d88-a8e7-42931121e295',
      tokenHash: 'a'.repeat(64),
      expiresAt: new Date('2026-12-02T12:00:00.000Z'),
      usedAt: null,
      revokedAt: null,
      createdAt: new Date('2026-12-01T12:00:00.000Z'),
      usuario: { passwordHash: 'hidden' },
    });

    const serialized = JSON.parse(JSON.stringify(token)) as Record<
      string,
      unknown
    >;

    expect(serialized).not.toHaveProperty('tokenHash');
    expect(serialized).not.toHaveProperty('usuario');
    expect(JSON.stringify(serialized)).not.toContain(token.tokenHash);
    expect(JSON.stringify(serialized)).not.toContain('passwordHash');
  });
});
