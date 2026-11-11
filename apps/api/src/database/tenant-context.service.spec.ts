import { DataSource, EntityManager, QueryRunner } from 'typeorm';
import { Empresa } from '../empresas/entities/empresa.entity.js';
import { createTenantScope, TenantScope } from '../tenancy/tenant-scope.js';
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
    const tenant = createTenantScope({
      id: '019a6f33-82b7-7a22-971b-6a8d7c5e4f30',
      slug: 'atelier-norte',
      schemaName: 'tenant_019a6f3382b77a22971b6a8d7c5e4f30',
    } as Empresa);

    await expect(service.run(tenant, operation)).resolves.toBe('done');
    expect(query).toHaveBeenCalledWith(
      'SET LOCAL search_path TO "tenant_019a6f3382b77a22971b6a8d7c5e4f30", pg_catalog',
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

    const invalidTenant = {
      empresaId: '019a6f33-82b7-7a22-971b-6a8d7c5e4f30',
      empresaSlug: 'atelier-norte',
      schemaName: 'tenant_119a6f3382b77a22971b6a8d7c5e4f30',
    } as TenantScope;

    await expect(service.run(invalidTenant, operation)).rejects.toThrow(
      'Invalid tenant scope',
    );
    expect(operation).not.toHaveBeenCalled();
    expect(rollbackTransaction).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
  });

  it('rolls back and releases the connection when the operation fails', async () => {
    const rollbackTransaction = vi.fn().mockResolvedValue(undefined);
    const commitTransaction = vi.fn();
    const release = vi.fn().mockResolvedValue(undefined);
    const queryRunner = {
      connect: vi.fn().mockResolvedValue(undefined),
      startTransaction: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([]),
      manager: {} as EntityManager,
      rollbackTransaction,
      commitTransaction,
      release,
      isTransactionActive: true,
    } as unknown as QueryRunner;
    const dataSource = {
      createQueryRunner: vi.fn(() => queryRunner),
    } as unknown as DataSource;
    const service = new TenantContextService(dataSource);
    const tenant = createTenantScope({
      id: '019a6f33-82b7-7a22-971b-6a8d7c5e4f30',
      slug: 'atelier-norte',
      schemaName: 'tenant_019a6f3382b77a22971b6a8d7c5e4f30',
    } as Empresa);

    await expect(
      service.run(tenant, () => Promise.reject(new Error('query failed'))),
    ).rejects.toThrow('query failed');
    expect(rollbackTransaction).toHaveBeenCalledOnce();
    expect(commitTransaction).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledOnce();
  });
});
