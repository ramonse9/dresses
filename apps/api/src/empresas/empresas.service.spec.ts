import { Repository } from 'typeorm';
import { Empresa } from './entities/empresa.entity.js';
import { EmpresasService } from './empresas.service.js';

describe('EmpresasService', () => {
  it('lists empresas in a stable order', async () => {
    const empresas = [
      { id: '1', nombre: 'Atelier Norte' },
      { id: '2', nombre: 'Boutique Centro' },
    ] as Empresa[];
    const find = vi.fn().mockResolvedValue(empresas);
    const repository = { find } as unknown as Repository<Empresa>;
    const service = new EmpresasService(repository);

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
    const service = new EmpresasService(repository);

    await expect(service.findActiveBySlug('atelier-norte')).resolves.toBe(
      empresa,
    );
    expect(findOne).toHaveBeenCalledWith({
      where: { slug: 'atelier-norte', activo: true },
    });
  });
});
