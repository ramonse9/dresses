import { getMetadataArgsStorage } from 'typeorm';
import { Usuario } from './usuario.entity.js';

describe('Usuario', () => {
  it('normalizes email before persistence', () => {
    const usuario = new Usuario();
    usuario.email = '  Owner@Example.COM  ';

    usuario.normalizeEmail();

    expect(usuario.email).toBe('owner@example.com');
  });

  it('never serializes passwordHash', () => {
    const usuario = new Usuario();
    usuario.id = 'user-id';
    usuario.email = 'owner@example.com';
    usuario.passwordHash = 'secret-hash';
    usuario.nombre = 'Owner';
    usuario.activo = true;
    usuario.passwordChangedAt = new Date('2026-12-01T12:00:00.000Z');

    const serialized = JSON.parse(JSON.stringify(usuario)) as Record<
      string,
      unknown
    >;

    expect(serialized).not.toHaveProperty('passwordHash');
    expect(serialized.email).toBe('owner@example.com');
    expect(serialized.passwordChangedAt).toBe('2026-12-01T12:00:00.000Z');
  });

  it('defines the optional password change timestamp', () => {
    const column = getMetadataArgsStorage().columns.find(
      (entry) =>
        entry.target === Usuario && entry.propertyName === 'passwordChangedAt',
    );

    expect(column?.options).toMatchObject({
      name: 'password_changed_at',
      type: 'timestamptz',
      nullable: true,
    });
  });
});
