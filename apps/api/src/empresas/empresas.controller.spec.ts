import { EmpresasController } from './empresas.controller.js';
import { Empresa } from './entities/empresa.entity.js';
import { EmpresasService } from './empresas.service.js';

describe('EmpresasController', () => {
  it('passes only normalized creation data to the service', async () => {
    const empresa = { id: 'generated-id' } as Empresa;
    const create = vi.fn().mockResolvedValue(empresa);
    const service = { create } as unknown as EmpresasService;
    const controller = new EmpresasController(service);

    await expect(
      controller.create({ nombre: ' Atelier Norte ', slug: 'Atelier-Norte' }),
    ).resolves.toBe(empresa);
    expect(create).toHaveBeenCalledWith({
      nombre: 'Atelier Norte',
      slug: 'atelier-norte',
    });
  });

  it('does not accept a schema name from the client', () => {
    const service = { create: vi.fn() } as unknown as EmpresasService;
    const controller = new EmpresasController(service);

    expect(() =>
      controller.create({
        nombre: 'Atelier Norte',
        slug: 'atelier-norte',
        schemaName: 'public',
      }),
    ).toThrow('Campo no permitido: schemaName');
  });
});
