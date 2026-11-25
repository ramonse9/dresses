import { QueryRunner } from 'typeorm';
import { CreateMovimientosFinancieros1795906800000 } from './1795906800000-create-movimientos-financieros.js';

describe('CreateMovimientosFinancieros tenant migration', () => {
  it('creates the append-only table, constraints, indexes and tenant FKs', async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    const migration = new CreateMovimientosFinancieros1795906800000();

    await migration.up(
      { query } as unknown as QueryRunner,
      'tenant_019a6f3382b77a22971b6a8d7c5e4f30',
    );

    expect(query).toHaveBeenCalledTimes(9);
    const sql = query.mock.calls.flat().join(' ');
    expect(query.mock.calls[0]?.[0]).toContain(
      'CREATE TABLE "tenant_019a6f3382b77a22971b6a8d7c5e4f30"."movimientos_financieros"',
    );
    expect(sql).toContain('numeric(12,2)');
    expect(sql).toContain('"monto" > 0');
    expect(sql).toContain('"CHK_movimientos_financieros_origen_por_tipo"');
    expect(sql).toContain('ON DELETE RESTRICT');
    expect(sql).toContain('"UQ_movimientos_financieros_idempotency_key"');
    expect(sql).toContain(
      '"IDX_movimientos_financieros_reservacion_created_at_id"',
    );
    expect(sql).toContain(
      '"IDX_movimientos_financieros_registrado_por_created_at"',
    );
    expect(sql).toContain('prevent_movimientos_financieros_mutation');
    expect(sql).toContain('TRG_movimientos_financieros_append_only');
  });

  it('rejects an unsafe schema before executing SQL', async () => {
    const query = vi.fn();
    const migration = new CreateMovimientosFinancieros1795906800000();

    await expect(
      migration.up(
        { query } as unknown as QueryRunner,
        'public; DROP SCHEMA public',
      ),
    ).rejects.toThrow('Invalid tenant schema name');
    expect(query).not.toHaveBeenCalled();
  });
});
