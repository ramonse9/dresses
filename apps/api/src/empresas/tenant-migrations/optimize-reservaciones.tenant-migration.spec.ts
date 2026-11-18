import { QueryRunner } from 'typeorm';
import { OptimizeReservaciones1795302000000 } from './1795302000000-optimize-reservaciones.js';

describe('OptimizeReservaciones tenant migration', () => {
  it('adds covering indexes for pagination, filters and overlap joins', async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    const migration = new OptimizeReservaciones1795302000000();

    await migration.up(
      { query } as unknown as QueryRunner,
      'tenant_019a6f3382b77a22971b6a8d7c5e4f30',
    );

    expect(query).toHaveBeenCalledTimes(7);
    expect(query.mock.calls[1]?.[0]).toContain(
      '"cliente_id", "created_at" DESC, "id" DESC',
    );
    expect(query.mock.calls[2]?.[0]).toContain(
      '"sucursal_id", "created_at" DESC, "id" DESC',
    );
    expect(query.mock.calls[3]?.[0]).toContain('"created_at" DESC, "id" DESC');
    expect(query.mock.calls[4]?.[0]).toContain('"fecha_inicio", "fecha_fin"');
    expect(query.mock.calls[6]?.[0]).toContain(
      '"vestido_id", "reservacion_id"',
    );
  });

  it('rejects unsafe schema names before changing indexes', async () => {
    const query = vi.fn();
    const migration = new OptimizeReservaciones1795302000000();

    await expect(
      migration.up(
        { query } as unknown as QueryRunner,
        'public; DROP SCHEMA public',
      ),
    ).rejects.toThrow('Invalid tenant schema name');
    expect(query).not.toHaveBeenCalled();
  });
});
