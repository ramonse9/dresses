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

    expect(query).toHaveBeenCalledTimes(20);
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
    expect(query.mock.calls[8]?.[0]).toContain('"vestidos"');
    expect(query.mock.calls[12]).toEqual([
      expect.stringContaining('INSERT INTO'),
      ['CreateVestidos1794697200000'],
    ]);
    expect(query.mock.calls[13]?.[0]).toContain('DROP INDEX');
    expect(query.mock.calls[14]?.[0]).toContain(
      '"sucursal_id", "created_at", "id"',
    );
    expect(query.mock.calls[19]).toEqual([
      expect.stringContaining('INSERT INTO'),
      ['OptimizeVestidosCatalog1794783600000'],
    ]);
  });

  it('applies pending migrations to every registered tenant', async () => {
    const query = vi
      .fn()
      .mockResolvedValue([
        { schemaName: 'tenant_019a6f3382b77a22971b6a8d7c5e4f30' },
        { schemaName: 'tenant_a18c2a56d33f4d88a8e742931121e295' },
      ]);
    const dataSource = { query } as unknown as DataSource;
    const service = new TenantMigrationService(dataSource);
    const ensureMigrations = vi
      .spyOn(service, 'ensureMigrations')
      .mockResolvedValue(undefined);

    await expect(service.migrateAllTenants()).resolves.toBe(2);
    expect(ensureMigrations).toHaveBeenNthCalledWith(
      1,
      'tenant_019a6f3382b77a22971b6a8d7c5e4f30',
    );
    expect(ensureMigrations).toHaveBeenNthCalledWith(
      2,
      'tenant_a18c2a56d33f4d88a8e742931121e295',
    );
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
