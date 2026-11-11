import { Injectable, NotFoundException } from '@nestjs/common';
import { EmpresasService } from '../empresas/empresas.service.js';
import { createTenantScope, TenantScope } from './tenant-scope.js';

@Injectable()
export class TenantResolverService {
  constructor(private readonly empresasService: EmpresasService) {}

  async resolveBySlug(slug: string): Promise<TenantScope> {
    const empresa = await this.empresasService.findActiveBySlug(slug);

    if (!empresa) {
      throw new NotFoundException('Empresa no encontrada');
    }

    return createTenantScope(empresa);
  }

  /**
   * Future JWT guards can resolve an already verified empresaId claim here.
   */
  async resolveByEmpresaId(empresaId: string): Promise<TenantScope> {
    const empresa = await this.empresasService.findActiveById(empresaId);

    if (!empresa) {
      throw new NotFoundException('Empresa no encontrada');
    }

    return createTenantScope(empresa);
  }
}
