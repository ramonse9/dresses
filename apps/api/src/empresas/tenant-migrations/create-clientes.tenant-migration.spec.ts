import { QueryRunner } from 'typeorm';
import { CreateClientes1794956400000 } from './1794956400000-create-clientes.js';

describe('CreateClientes tenant migration', () => {
  it('creates the table, validation constraints and non-unique indexes', async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    const migration = new CreateClientes1794956400000();

    await migration.up(
      { query } as unknown as QueryRunner,
      'tenant_019a6f3382b77a22971b6a8d7c5e4f30',
    );

    expect(query).toHaveBeenCalledTimes(5);
    expect(query.mock.calls[0]?.[0]).toContain(
      'CREATE TABLE "tenant_019a6f3382b77a22971b6a8d7c5e4f30"."clientes"',
    );
    expect(query.mock.calls[0]?.[0]).toContain(
      '"CHK_clientes_contacto_requerido"',
    );
    expect(query.mock.calls[0]?.[0]).toContain(
      '"CHK_clientes_email_normalized"',
    );
    expect(query.mock.calls[1]?.[0]).toContain('"activo", "created_at", "id"');
    expect(query.mock.calls[2]?.[0]).toContain('LOWER("nombre")');
    expect(query.mock.calls[3]?.[0]).toContain('LOWER("email")');
    expect(query.mock.calls[3]?.[0]).toContain('WHERE "email" IS NOT NULL');
    expect(query.mock.calls[4]?.[0]).toContain('WHERE "telefono" IS NOT NULL');
    expect(query.mock.calls.flat().join(' ')).not.toContain('UNIQUE INDEX');
  });

  it('rejects an unsafe schema name before executing SQL', async () => {
    const query = vi.fn();
    const migration = new CreateClientes1794956400000();

    await expect(
      migration.up(
        { query } as unknown as QueryRunner,
        'public; DROP SCHEMA public',
      ),
    ).rejects.toThrow('Invalid tenant schema name');
    expect(query).not.toHaveBeenCalled();
  });
});
