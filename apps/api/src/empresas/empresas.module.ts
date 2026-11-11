import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DevTenantAdminGuard } from './dev-tenant-admin.guard.js';
import { EmpresasController } from './empresas.controller.js';
import { Empresa } from './entities/empresa.entity.js';
import { EmpresasService } from './empresas.service.js';
import { TenantMigrationService } from './tenant-migrations/tenant-migration.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Empresa])],
  controllers: [EmpresasController],
  providers: [EmpresasService, TenantMigrationService, DevTenantAdminGuard],
  exports: [EmpresasService, TenantMigrationService],
})
export class EmpresasModule {}
