import { getMetadataArgsStorage } from 'typeorm';
import { Cliente } from './cliente.tenant-entity.js';

describe('Cliente tenant entity', () => {
  it('defines the tenant table and expected column lengths', () => {
    const metadata = getMetadataArgsStorage();
    const table = metadata.tables.find((entry) => entry.target === Cliente);
    const columns = metadata.columns.filter(
      (column) => column.target === Cliente,
    );
    const byName = (propertyName: string) =>
      columns.find((column) => column.propertyName === propertyName)?.options;

    expect(table?.name).toBe('clientes');
    expect(byName('nombre')).toMatchObject({ length: 160 });
    expect(byName('telefono')).toMatchObject({ length: 40, nullable: true });
    expect(byName('email')).toMatchObject({ length: 254, nullable: true });
    expect(byName('direccion')).toMatchObject({
      length: 255,
      nullable: true,
    });
    expect(byName('notas')).toMatchObject({ length: 2_000, nullable: true });
    expect(byName('activo')).toMatchObject({ default: true });
  });

  it('normalizes contact and optional text without deduplicating values', () => {
    const cliente = Object.assign(new Cliente(), {
      nombre: '  Ana López  ',
      telefono: '  555-0100  ',
      email: '  ANA@EXAMPLE.COM  ',
      direccion: '   ',
      notas: '  Cliente frecuente  ',
    });

    cliente.normalize();

    expect(cliente).toMatchObject({
      nombre: 'Ana López',
      telefono: '555-0100',
      email: 'ana@example.com',
      direccion: null,
      notas: 'Cliente frecuente',
    });
  });

  it('converts missing or empty optional contact values to null', () => {
    const cliente = Object.assign(new Cliente(), {
      nombre: 'Cliente',
      telefono: ' ',
      email: undefined,
      direccion: '',
      notas: null,
    });

    cliente.normalize();

    expect(cliente.telefono).toBeNull();
    expect(cliente.email).toBeNull();
    expect(cliente.direccion).toBeNull();
    expect(cliente.notas).toBeNull();
  });

  it('declares contact constraints and non-unique search indexes', () => {
    const metadata = getMetadataArgsStorage();
    const checks = metadata.checks.filter((check) => check.target === Cliente);
    const indexes = metadata.indices.filter(
      (index) => index.target === Cliente,
    );

    expect(checks.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        'CHK_clientes_nombre_normalized',
        'CHK_clientes_contacto_requerido',
        'CHK_clientes_telefono_normalized',
        'CHK_clientes_email_normalized',
      ]),
    );
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'IDX_clientes_activo_created_at',
          columns: ['activo', 'createdAt', 'id'],
        }),
        expect.objectContaining({
          name: 'IDX_clientes_nombre_normalized',
          synchronize: false,
        }),
        expect.objectContaining({
          name: 'IDX_clientes_email_normalized',
          synchronize: false,
        }),
        expect.objectContaining({
          name: 'IDX_clientes_telefono',
          synchronize: false,
        }),
      ]),
    );
    expect(indexes.every((index) => index.unique !== true)).toBe(true);
  });
});
