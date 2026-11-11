import { DataSource, QueryRunner } from 'typeorm';
import { TenantMigrationService } from './tenant-migration.service.js';

describe('TenantMigrationService', () => {
  it('creates tenant tables and records all pending migrations', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ '?column?': 1 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const queryRunner = { query } as unknown as QueryRunner;
    const service = new TenantMigrationService({} as DataSource);

    await service.runMigrations(
      queryRunner,
      'tenant_019a6f3382b77a22971b6a8d7c5e4f30',
    );

    expect(query).toHaveBeenCalledTimes(8);
    expect(query.mock.calls[0]?.[0]).toContain(
      '"tenant_019a6f3382b77a22971b6a8d7c5e4f30"."tenant_migrations"',
    );
    expect(query.mock.calls[3]).toEqual([
      expect.stringContaining('INSERT INTO'),
      ['InitializeTenant1794377000000'],
    ]);
    expect(query.mock.calls[4]?.[0]).toContain('"sucursales"');
    expect(query.mock.calls[7]).toEqual([
      expect.stringContaining('INSERT INTO'),
      ['CreateSucursales1794378000000'],
    ]);
  });

  it('rejects schema identifiers outside the backend convention', async () => {
    const query = vi.fn();
    const queryRunner = { query } as unknown as QueryRunner;
    const service = new TenantMigrationService({} as DataSource);

    await expect(
      service.runMigrations(queryRunner, 'public; DROP SCHEMA public'),
    ).rejects.toThrow('Invalid tenant schema name');
    expect(query).not.toHaveBeenCalled();
  });
});
