import { Module } from '@nestjs/common';
import { EmpresasModule } from '../empresas/empresas.module.js';
import { TenantResolverService } from './tenant-resolver.service.js';

@Module({
  imports: [EmpresasModule],
  providers: [TenantResolverService],
  exports: [EmpresasModule, TenantResolverService],
})
export class TenancyModule {}
