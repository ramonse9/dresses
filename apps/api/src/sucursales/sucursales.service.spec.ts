import { ConflictException, NotFoundException } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { TenantContextService } from '../database/tenant-context.service.js';
import { TenantMigrationService } from '../empresas/tenant-migrations/tenant-migration.service.js';
import { TenantResolverService } from '../tenancy/tenant-resolver.service.js';
import { TenantScope } from '../tenancy/tenant-scope.js';
import { Sucursal } from './entities/sucursal.tenant-entity.js';
import { SucursalesService } from './sucursales.service.js';

function buildService(repository: Partial<Repository<Sucursal>>) {
  const tenant = {
    empresaId: '019a6f33-82b7-7a22-971b-6a8d7c5e4f30',
    empresaSlug: 'atelier-norte',
    schemaName: 'tenant_019a6f3382b77a22971b6a8d7c5e4f30',
  } as TenantScope;
  const resolveBySlug = vi.fn().mockResolvedValue(tenant);
  const tenantResolver = { resolveBySlug } as unknown as TenantResolverService;
  const ensureMigrations = vi.fn().mockResolvedValue(undefined);
  const tenantMigrationService = {
    ensureMigrations,
  } as unknown as TenantMigrationService;
  const manager = {
    getRepository: vi.fn(() => repository),
  } as unknown as EntityManager;
  const run = vi.fn(
    async (
      _tenant: TenantScope,
      operation: (value: EntityManager) => unknown,
    ) => operation(manager),
  );
  const tenantContext = { run } as unknown as TenantContextService;
  const service = new SucursalesService(
    tenantResolver,
    tenantContext,
    tenantMigrationService,
  );

  return { service, resolveBySlug, ensureMigrations, run, tenant };
}

describe('SucursalesService', () => {
  it('creates a sucursal in the resolved tenant', async () => {
    const sucursal = {
      id: 'd18c2a56-d33f-4d88-a8e7-42931121e295',
      nombre: 'Centro',
      activo: true,
    } as Sucursal;
    const findOne = vi.fn().mockResolvedValue(null);
    const create = vi.fn().mockReturnValue(sucursal);
    const save = vi.fn().mockResolvedValue(sucursal);
    const { service, ensureMigrations, run, tenant } = buildService({
      findOne,
      create,
      save,
    });

    await expect(
      service.create('atelier-norte', { nombre: 'Centro' }),
    ).resolves.toBe(sucursal);
    expect(ensureMigrations).toHaveBeenCalledWith(
      'tenant_019a6f3382b77a22971b6a8d7c5e4f30',
    );
    expect(run).toHaveBeenCalledWith(tenant, expect.any(Function));
    expect(create).toHaveBeenCalledWith({
      nombre: 'Centro',
      direccion: null,
      telefono: null,
      activo: true,
    });
  });

  it('rejects duplicate names inside the same tenant', async () => {
    const findOne = vi.fn().mockResolvedValue({ id: 'existing' });
    const { service } = buildService({ findOne });

    await expect(
      service.create('atelier-norte', { nombre: 'Centro' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('deactivates without deleting the record', async () => {
    const sucursal = {
      id: 'd18c2a56-d33f-4d88-a8e7-42931121e295',
      nombre: 'Centro',
      activo: true,
    } as Sucursal;
    const findOne = vi.fn().mockResolvedValue(sucursal);
    const save = vi.fn().mockImplementation((value) => Promise.resolve(value));
    const { service } = buildService({ findOne, save });

    await expect(
      service.deactivate('atelier-norte', sucursal.id),
    ).resolves.toMatchObject({ activo: false });
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ id: sucursal.id, activo: false }),
    );
  });

  it('returns 404 when the empresa does not exist', async () => {
    const { service, resolveBySlug } = buildService({});
    resolveBySlug.mockRejectedValue(
      new NotFoundException('Empresa no encontrada'),
    );

    await expect(service.findAll('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
