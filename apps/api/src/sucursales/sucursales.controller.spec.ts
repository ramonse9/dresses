import { Sucursal } from './entities/sucursal.tenant-entity.js';
import { SucursalesController } from './sucursales.controller.js';
import { SucursalesService } from './sucursales.service.js';

describe('SucursalesController', () => {
  it('normalizes and forwards creation data', async () => {
    const sucursal = { id: 'branch-id', nombre: 'Centro' } as Sucursal;
    const create = vi.fn().mockResolvedValue(sucursal);
    const service = { create } as unknown as SucursalesService;
    const controller = new SucursalesController(service);

    await expect(
      controller.create('Atelier-Norte', {
        nombre: ' Centro ',
        direccion: ' Av. Principal 123 ',
      }),
    ).resolves.toBe(sucursal);
    expect(create).toHaveBeenCalledWith('atelier-norte', {
      nombre: 'Centro',
      direccion: 'Av. Principal 123',
    });
  });

  it('forwards logical deactivation without deleting', async () => {
    const sucursal = { id: 'branch-id', activo: false } as Sucursal;
    const deactivate = vi.fn().mockResolvedValue(sucursal);
    const service = { deactivate } as unknown as SucursalesService;
    const controller = new SucursalesController(service);

    await expect(
      controller.deactivate('atelier-norte', 'branch-id'),
    ).resolves.toBe(sucursal);
    expect(deactivate).toHaveBeenCalledWith('atelier-norte', 'branch-id');
  });
});
