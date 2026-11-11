import {
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { Empresa } from './entities/empresa.entity.js';
import { EmpresasService } from './empresas.service.js';
import { isTenantSchemaName } from './tenant-schema-name.js';
import { TenantMigrationService } from './tenant-migrations/tenant-migration.service.js';

function createReadService(repository: Repository<Empresa>): EmpresasService {
  return new EmpresasService(
    repository,
    {} as DataSource,
    {} as TenantMigrationService,
  );
}

describe('EmpresasService', () => {
  it('lists empresas in a stable order', async () => {
    const empresas = [
      { id: '1', nombre: 'Atelier Norte' },
      { id: '2', nombre: 'Boutique Centro' },
    ] as Empresa[];
    const find = vi.fn().mockResolvedValue(empresas);
    const repository = { find } as unknown as Repository<Empresa>;
    const service = createReadService(repository);

    await expect(service.findAll()).resolves.toEqual(empresas);
    expect(find).toHaveBeenCalledWith({ order: { nombre: 'ASC' } });
  });

  it('looks up only active empresas using a parameterized repository filter', async () => {
    const empresa = {
      id: '1',
      slug: 'atelier-norte',
      activo: true,
    } as Empresa;
    const findOne = vi.fn().mockResolvedValue(empresa);
    const repository = { findOne } as unknown as Repository<Empresa>;
    const service = createReadService(repository);

    await expect(service.findActiveBySlug('atelier-norte')).resolves.toBe(
      empresa,
    );
    expect(findOne).toHaveBeenCalledWith({
      where: { slug: 'atelier-norte', activo: true },
    });
  });

  it('creates the empresa, safe schema and tenant migrations atomically', async () => {
    const findOne = vi.fn().mockResolvedValue(null);
    const create = vi.fn((input: Partial<Empresa>) => input as Empresa);
    const save = vi.fn((empresa: Empresa) => Promise.resolve(empresa));
    const transactionRepository = { findOne, create, save };
    const query = vi.fn().mockResolvedValue([]);
    const commitTransaction = vi.fn().mockResolvedValue(undefined);
    const rollbackTransaction = vi.fn().mockResolvedValue(undefined);
    const release = vi.fn().mockResolvedValue(undefined);
    const queryRunner = {
      connect: vi.fn().mockResolvedValue(undefined),
      startTransaction: vi.fn().mockResolvedValue(undefined),
      manager: { getRepository: vi.fn(() => transactionRepository) },
      query,
      commitTransaction,
      rollbackTransaction,
      release,
      isTransactionActive: true,
    } as unknown as QueryRunner;
    const dataSource = {
      createQueryRunner: vi.fn(() => queryRunner),
    } as unknown as DataSource;
    const runInitialMigrations = vi.fn().mockResolvedValue(undefined);
    const migrations = {
      runInitialMigrations,
    } as unknown as TenantMigrationService;
    const service = new EmpresasService(
      {} as Repository<Empresa>,
      dataSource,
      migrations,
    );

    const empresa = await service.create({
      nombre: 'Atelier Norte',
      slug: 'atelier-norte',
    });

    expect(isTenantSchemaName(empresa.schemaName)).toBe(true);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: 'Atelier Norte',
        slug: 'atelier-norte',
        activo: true,
      }),
    );
    expect(query).toHaveBeenCalledWith(`CREATE SCHEMA "${empresa.schemaName}"`);
    expect(runInitialMigrations).toHaveBeenCalledWith(
      queryRunner,
      empresa.schemaName,
    );
    expect(commitTransaction).toHaveBeenCalledOnce();
    expect(rollbackTransaction).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledOnce();
  });

  it('rejects a duplicate slug before creating a schema', async () => {
    const findOne = vi.fn().mockResolvedValue({ id: 'existing' });
    const query = vi.fn();
    const rollbackTransaction = vi.fn().mockResolvedValue(undefined);
    const release = vi.fn().mockResolvedValue(undefined);
    const queryRunner = {
      connect: vi.fn().mockResolvedValue(undefined),
      startTransaction: vi.fn().mockResolvedValue(undefined),
      manager: { getRepository: vi.fn(() => ({ findOne })) },
      query,
      rollbackTransaction,
      release,
      isTransactionActive: true,
    } as unknown as QueryRunner;
    const dataSource = {
      createQueryRunner: vi.fn(() => queryRunner),
    } as unknown as DataSource;
    const service = new EmpresasService(
      {} as Repository<Empresa>,
      dataSource,
      {} as TenantMigrationService,
    );

    await expect(
      service.create({ nombre: 'Duplicada', slug: 'atelier-norte' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(query).not.toHaveBeenCalled();
    expect(rollbackTransaction).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledOnce();
  });

  it('rolls back the empresa and schema when tenant migrations fail', async () => {
    const transactionRepository = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn((input: Partial<Empresa>) => input as Empresa),
      save: vi.fn((empresa: Empresa) => Promise.resolve(empresa)),
    };
    const rollbackTransaction = vi.fn().mockResolvedValue(undefined);
    const commitTransaction = vi.fn();
    const release = vi.fn().mockResolvedValue(undefined);
    const queryRunner = {
      connect: vi.fn().mockResolvedValue(undefined),
      startTransaction: vi.fn().mockResolvedValue(undefined),
      manager: { getRepository: vi.fn(() => transactionRepository) },
      query: vi.fn().mockResolvedValue([]),
      rollbackTransaction,
      commitTransaction,
      release,
      isTransactionActive: true,
    } as unknown as QueryRunner;
    const dataSource = {
      createQueryRunner: vi.fn(() => queryRunner),
    } as unknown as DataSource;
    const migrations = {
      runInitialMigrations: vi
        .fn()
        .mockRejectedValue(new Error('migration failed')),
    } as unknown as TenantMigrationService;
    const service = new EmpresasService(
      {} as Repository<Empresa>,
      dataSource,
      migrations,
    );

    await expect(
      service.create({ nombre: 'Atelier Norte', slug: 'atelier-norte' }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(rollbackTransaction).toHaveBeenCalledOnce();
    expect(commitTransaction).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledOnce();
  });
});
