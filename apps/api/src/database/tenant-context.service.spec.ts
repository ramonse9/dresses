import { DataSource, EntityManager, QueryRunner } from 'typeorm';
import { TenantContextService } from './tenant-context.service.js';

describe('TenantContextService', () => {
  it('sets a transaction-local tenant search path', async () => {
    const query = vi.fn().mockResolvedValue([]);
    const commitTransaction = vi.fn().mockResolvedValue(undefined);
    const release = vi.fn().mockResolvedValue(undefined);
    const manager = {} as EntityManager;
    const queryRunner = {
      connect: vi.fn().mockResolvedValue(undefined),
      startTransaction: vi.fn().mockResolvedValue(undefined),
      query,
      manager,
      commitTransaction,
      release,
      isTransactionActive: true,
    } as unknown as QueryRunner;
    const dataSource = {
      createQueryRunner: vi.fn(() => queryRunner),
    } as unknown as DataSource;
    const service = new TenantContextService(dataSource);
    const operation = vi.fn().mockResolvedValue('done');

    await expect(
      service.run('tenant_019a6f3382b77a22971b6a8d7c5e4f30', operation),
    ).resolves.toBe('done');
    expect(query).toHaveBeenCalledWith(
      'SET LOCAL search_path TO "tenant_019a6f3382b77a22971b6a8d7c5e4f30", public',
    );
    expect(operation).toHaveBeenCalledWith(manager);
    expect(commitTransaction).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledOnce();
  });

  it('rejects an unsafe schema before running the operation', async () => {
    const rollbackTransaction = vi.fn().mockResolvedValue(undefined);
    const release = vi.fn().mockResolvedValue(undefined);
    const queryRunner = {
      connect: vi.fn().mockResolvedValue(undefined),
      startTransaction: vi.fn().mockResolvedValue(undefined),
      query: vi.fn(),
      rollbackTransaction,
      release,
      isTransactionActive: true,
    } as unknown as QueryRunner;
    const dataSource = {
      createQueryRunner: vi.fn(() => queryRunner),
    } as unknown as DataSource;
    const service = new TenantContextService(dataSource);
    const operation = vi.fn();

    await expect(service.run('public', operation)).rejects.toThrow(
      'Invalid tenant schema name',
    );
    expect(operation).not.toHaveBeenCalled();
    expect(rollbackTransaction).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledOnce();
  });
});
