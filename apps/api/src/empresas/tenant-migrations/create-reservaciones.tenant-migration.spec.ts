import { QueryRunner } from 'typeorm';
import { CreateReservaciones1795215600000 } from './1795215600000-create-reservaciones.js';

describe('CreateReservaciones tenant migration', () => {
  it('creates both tables, constraints, indexes and same-schema foreign keys', async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    const migration = new CreateReservaciones1795215600000();

    await migration.up(
      { query } as unknown as QueryRunner,
      'tenant_019a6f3382b77a22971b6a8d7c5e4f30',
    );

    expect(query).toHaveBeenCalledTimes(7);
    const sql = query.mock.calls.flat().join(' ');
    expect(query.mock.calls[0]?.[0]).toContain(
      'CREATE TABLE "tenant_019a6f3382b77a22971b6a8d7c5e4f30"."reservaciones"',
    );
    expect(query.mock.calls[4]?.[0]).toContain(
      'CREATE TABLE "tenant_019a6f3382b77a22971b6a8d7c5e4f30"."reservacion_vestidos"',
    );
    expect(sql).toContain('"CHK_reservaciones_fechas"');
    expect(sql).toContain('"CHK_reservaciones_estado"');
    expect(sql).toContain('numeric(12,2)');
    expect(sql).toContain('ON DELETE RESTRICT');
    expect(sql).toContain('"UQ_reservacion_vestidos_reservacion_vestido"');
    expect(sql).toContain('"IDX_reservaciones_sucursal_estado_fechas"');
    expect(sql).toContain('"IDX_reservacion_vestidos_vestido_id"');
  });

  it('rejects an unsafe schema name before executing SQL', async () => {
    const query = vi.fn();
    const migration = new CreateReservaciones1795215600000();

    await expect(
      migration.up(
        { query } as unknown as QueryRunner,
        'public; DROP SCHEMA public',
      ),
    ).rejects.toThrow('Invalid tenant schema name');
    expect(query).not.toHaveBeenCalled();
  });
});
