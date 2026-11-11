import { QueryRunner } from 'typeorm';
import { TenantMigrationService } from './tenant-migration.service.js';

describe('TenantMigrationService', () => {
  it('creates the migration table and records the initial migration', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ '?column?': 1 }])
      .mockResolvedValueOnce([]);
    const queryRunner = { query } as unknown as QueryRunner;
    const service = new TenantMigrationService();

    await service.runInitialMigrations(
      queryRunner,
      'tenant_019a6f3382b77a22971b6a8d7c5e4f30',
    );

    expect(query).toHaveBeenCalledTimes(4);
    expect(query.mock.calls[0]?.[0]).toContain(
      '"tenant_019a6f3382b77a22971b6a8d7c5e4f30"."tenant_migrations"',
    );
    expect(query.mock.calls[3]).toEqual([
      expect.stringContaining('INSERT INTO'),
      ['InitializeTenant1794377000000'],
    ]);
  });

  it('rejects schema identifiers outside the backend convention', async () => {
    const query = vi.fn();
    const queryRunner = { query } as unknown as QueryRunner;
    const service = new TenantMigrationService();

    await expect(
      service.runInitialMigrations(queryRunner, 'public; DROP SCHEMA public'),
    ).rejects.toThrow('Invalid tenant schema name');
    expect(query).not.toHaveBeenCalled();
  });
});
