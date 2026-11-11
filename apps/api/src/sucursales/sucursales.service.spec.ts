import { ConflictException, NotFoundException } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { TenantContextService } from '../database/tenant-context.service.js';
import { Empresa } from '../empresas/entities/empresa.entity.js';
import { EmpresasService } from '../empresas/empresas.service.js';
import { TenantMigrationService } from '../empresas/tenant-migrations/tenant-migration.service.js';
import { Sucursal } from './entities/sucursal.tenant-entity.js';
import { SucursalesService } from './sucursales.service.js';

function buildService(repository: Partial<Repository<Sucursal>>) {
  const empresa = {
    slug: 'atelier-norte',
    schemaName: 'tenant_019a6f3382b77a22971b6a8d7c5e4f30',
    activo: true,
  } as Empresa;
  const findActiveBySlug = vi.fn().mockResolvedValue(empresa);
  const empresasService = { findActiveBySlug } as unknown as EmpresasService;
  const ensureMigrations = vi.fn().mockResolvedValue(undefined);
  const tenantMigrationService = {
    ensureMigrations,
  } as unknown as TenantMigrationService;
  const manager = {
    getRepository: vi.fn(() => repository),
  } as unknown as EntityManager;
  const run = vi.fn(
    async (_schema: string, operation: (value: EntityManager) => unknown) =>
      operation(manager),
  );
  const tenantContext = { run } as unknown as TenantContextService;
  const service = new SucursalesService(
    empresasService,
    tenantContext,
    tenantMigrationService,
  );

  return { service, findActiveBySlug, ensureMigrations, run };
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
    const { service, ensureMigrations, run } = buildService({
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
    expect(run).toHaveBeenCalledWith(
      'tenant_019a6f3382b77a22971b6a8d7c5e4f30',
      expect.any(Function),
    );
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
    const { service, findActiveBySlug } = buildService({});
    findActiveBySlug.mockResolvedValue(null);

    await expect(service.findAll('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
