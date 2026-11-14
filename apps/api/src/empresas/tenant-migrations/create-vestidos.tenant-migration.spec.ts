import { QueryRunner } from 'typeorm';
import { CreateVestidos1794697200000 } from './1794697200000-create-vestidos.js';

describe('CreateVestidos tenant migration', () => {
  it('creates the tenant table, constraints and indexes', async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    const migration = new CreateVestidos1794697200000();

    await migration.up(
      { query } as unknown as QueryRunner,
      'tenant_019a6f3382b77a22971b6a8d7c5e4f30',
    );

    expect(query).toHaveBeenCalledTimes(4);
    expect(query.mock.calls[0]?.[0]).toContain(
      'CREATE TABLE "tenant_019a6f3382b77a22971b6a8d7c5e4f30"."vestidos"',
    );
    expect(query.mock.calls[0]?.[0]).toContain('numeric(12,2)');
    expect(query.mock.calls[0]?.[0]).toContain(
      'CONSTRAINT "FK_vestidos_sucursal"',
    );
    expect(query.mock.calls[0]?.[0]).toContain('ON DELETE RESTRICT');
    expect(query.mock.calls[0]?.[0]).toContain(
      'CONSTRAINT "CHK_vestidos_estado_operativo"',
    );
    expect(query.mock.calls[1]?.[0]).toContain(
      '"UQ_vestidos_codigo_normalized"',
    );
    expect(query.mock.calls[1]?.[0]).toContain('LOWER("codigo")');
    expect(query.mock.calls[2]?.[0]).toContain('"IDX_vestidos_sucursal_id"');
    expect(query.mock.calls[3]?.[0]).toContain('"IDX_vestidos_activo"');
  });

  it('rejects an unsafe schema name before executing SQL', async () => {
    const query = vi.fn();
    const migration = new CreateVestidos1794697200000();

    await expect(
      migration.up(
        { query } as unknown as QueryRunner,
        'public; DROP SCHEMA public',
      ),
    ).rejects.toThrow('Invalid tenant schema name');
    expect(query).not.toHaveBeenCalled();
  });
});
