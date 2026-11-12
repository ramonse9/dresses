import type { TenantScope } from '../tenancy/tenant-scope.js';
import { Sucursal } from './entities/sucursal.tenant-entity.js';
import { SucursalesController } from './sucursales.controller.js';
import { SucursalesService } from './sucursales.service.js';

describe('SucursalesController', () => {
  const tenant = {
    empresaId: 'a18c2a56-d33f-4d88-a8e7-42931121e295',
    empresaSlug: 'atelier-norte',
    schemaName: 'tenant_a18c2a56d33f4d88a8e742931121e295',
  } as TenantScope;

  it('forwards the authenticated TenantScope and normalized creation data', async () => {
    const sucursal = { id: 'branch-id', nombre: 'Centro' } as Sucursal;
    const create = vi.fn().mockResolvedValue(sucursal);
    const service = { create } as unknown as SucursalesService;
    const controller = new SucursalesController(service);

    await expect(
      controller.create(tenant, {
        nombre: ' Centro ',
        direccion: ' Av. Principal 123 ',
      }),
    ).resolves.toBe(sucursal);
    expect(create).toHaveBeenCalledWith(tenant, {
      nombre: 'Centro',
      direccion: 'Av. Principal 123',
    });
  });

  it('forwards logical deactivation without tenant identifiers from HTTP', async () => {
    const sucursal = { id: 'branch-id', activo: false } as Sucursal;
    const deactivate = vi.fn().mockResolvedValue(sucursal);
    const service = { deactivate } as unknown as SucursalesService;
    const controller = new SucursalesController(service);

    await expect(controller.deactivate(tenant, 'branch-id')).resolves.toBe(
      sucursal,
    );
    expect(deactivate).toHaveBeenCalledWith(tenant, 'branch-id');
  });
});
