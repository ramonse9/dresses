import { NotFoundException } from '@nestjs/common';
import { Empresa } from '../empresas/entities/empresa.entity.js';
import { EmpresasService } from '../empresas/empresas.service.js';
import { TenantResolverService } from './tenant-resolver.service.js';

describe('TenantResolverService', () => {
  it('resolves a trusted scope from a slug, not from a schema parameter', async () => {
    const empresa = {
      id: '019a6f33-82b7-7a22-971b-6a8d7c5e4f30',
      slug: 'atelier-norte',
      schemaName: 'tenant_019a6f3382b77a22971b6a8d7c5e4f30',
      activo: true,
    } as Empresa;
    const findActiveBySlug = vi.fn().mockResolvedValue(empresa);
    const empresasService = {
      findActiveBySlug,
    } as unknown as EmpresasService;
    const service = new TenantResolverService(empresasService);

    await expect(service.resolveBySlug('atelier-norte')).resolves.toMatchObject(
      {
        empresaId: empresa.id,
        schemaName: empresa.schemaName,
      },
    );
    expect(findActiveBySlug).toHaveBeenCalledWith('atelier-norte');
  });

  it('does not resolve inactive or missing empresas', async () => {
    const empresasService = {
      findActiveBySlug: vi.fn().mockResolvedValue(null),
    } as unknown as EmpresasService;
    const service = new TenantResolverService(empresasService);

    await expect(service.resolveBySlug('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
