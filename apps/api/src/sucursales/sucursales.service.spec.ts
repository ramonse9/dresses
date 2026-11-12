import { ConflictException, NotFoundException } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { TenantContextService } from '../database/tenant-context.service.js';
import type { TenantScope } from '../tenancy/tenant-scope.js';
import { Sucursal } from './entities/sucursal.tenant-entity.js';
import { SucursalesService } from './sucursales.service.js';

function buildService(repository: Partial<Repository<Sucursal>>) {
  const tenant = {
    empresaId: '019a6f33-82b7-7a22-971b-6a8d7c5e4f30',
    empresaSlug: 'atelier-norte',
    schemaName: 'tenant_019a6f3382b77a22971b6a8d7c5e4f30',
  } as TenantScope;
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
  const service = new SucursalesService(tenantContext);

  return { service, run, tenant };
}

describe('SucursalesService', () => {
  it('creates a sucursal using only the authenticated tenant', async () => {
    const sucursal = {
      id: 'd18c2a56-d33f-4d88-a8e7-42931121e295',
      nombre: 'Centro',
      activo: true,
    } as Sucursal;
    const findOne = vi.fn().mockResolvedValue(null);
    const create = vi.fn().mockReturnValue(sucursal);
    const save = vi.fn().mockResolvedValue(sucursal);
    const { service, run, tenant } = buildService({ findOne, create, save });

    await expect(service.create(tenant, { nombre: 'Centro' })).resolves.toBe(
      sucursal,
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
    const { service, tenant } = buildService({ findOne });

    await expect(
      service.create(tenant, { nombre: 'Centro' }),
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
    const { service, tenant } = buildService({ findOne, save });

    await expect(
      service.deactivate(tenant, sucursal.id),
    ).resolves.toMatchObject({ activo: false });
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ id: sucursal.id, activo: false }),
    );
  });

  it('returns 404 when an id is absent from the authenticated tenant', async () => {
    const findOne = vi.fn().mockResolvedValue(null);
    const { service, tenant } = buildService({ findOne });

    await expect(
      service.findOne(tenant, 'd18c2a56-d33f-4d88-a8e7-42931121e295'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
