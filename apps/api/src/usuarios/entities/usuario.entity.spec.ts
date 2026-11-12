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

    const serialized = JSON.parse(JSON.stringify(usuario)) as Record<
      string,
      unknown
    >;

    expect(serialized).not.toHaveProperty('passwordHash');
    expect(serialized.email).toBe('owner@example.com');
  });
});
