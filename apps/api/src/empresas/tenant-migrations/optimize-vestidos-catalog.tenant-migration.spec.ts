import { QueryRunner } from 'typeorm';
import { OptimizeVestidosCatalog1794783600000 } from './1794783600000-optimize-vestidos-catalog.js';

describe('OptimizeVestidosCatalog tenant migration', () => {
  it('adds stable-order indexes for the catalog filters', async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    const migration = new OptimizeVestidosCatalog1794783600000();

    await migration.up(
      { query } as unknown as QueryRunner,
      'tenant_019a6f3382b77a22971b6a8d7c5e4f30',
    );

    expect(query).toHaveBeenCalledTimes(6);
    expect(query.mock.calls[1]?.[0]).toContain(
      '"sucursal_id", "created_at", "id"',
    );
    expect(query.mock.calls[3]?.[0]).toContain('"activo", "created_at", "id"');
    expect(query.mock.calls[4]?.[0]).toContain(
      '"estado_operativo", "created_at", "id"',
    );
    expect(query.mock.calls[5]?.[0]).toContain('"IDX_vestidos_catalog_order"');
  });

  it('rejects an unsafe schema before changing indexes', async () => {
    const query = vi.fn();
    const migration = new OptimizeVestidosCatalog1794783600000();

    await expect(
      migration.up(
        { query } as unknown as QueryRunner,
        'public; DROP SCHEMA public',
      ),
    ).rejects.toThrow('Invalid tenant schema name');
    expect(query).not.toHaveBeenCalled();
  });
});
