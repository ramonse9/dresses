import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { TenantContextService } from '../src/database/tenant-context.service.js';
import { Empresa } from '../src/empresas/entities/empresa.entity.js';
import { EmpresasService } from '../src/empresas/empresas.service.js';
import { quoteTenantSchemaName } from '../src/empresas/tenant-schema-name.js';
import { SucursalesService } from '../src/sucursales/sucursales.service.js';
import { TenantResolverService } from '../src/tenancy/tenant-resolver.service.js';

describe('PostgreSQL tenant isolation', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let empresasService: EmpresasService;
  let sucursalesService: SucursalesService;
  let tenantResolver: TenantResolverService;
  let tenantContext: TenantContextService;

  const suffix = `${process.pid}-${Date.now()}`;
  const slugA = `isolation-a-${suffix}`;
  const slugB = `isolation-b-${suffix}`;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await moduleRef.init();

    dataSource = moduleRef.get(DataSource);
    empresasService = moduleRef.get(EmpresasService);
    sucursalesService = moduleRef.get(SucursalesService);
    tenantResolver = moduleRef.get(TenantResolverService);
    tenantContext = moduleRef.get(TenantContextService);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      const repository = dataSource.getRepository(Empresa);

      for (const slug of [slugA, slugB]) {
        const empresa = await repository.findOne({ where: { slug } });

        if (empresa) {
          await dataSource.query(
            `DROP SCHEMA IF EXISTS ${quoteTenantSchemaName(empresa.schemaName)} CASCADE`,
          );
          await repository.delete({ id: empresa.id });
        }
      }
    }

    await moduleRef?.close();
  });

  it('keeps two empresas and their sucursales isolated on a reused connection', async () => {
    await empresasService.create({ nombre: 'Isolation A', slug: slugA });
    await empresasService.create({ nombre: 'Isolation B', slug: slugB });

    const aCentro = await sucursalesService.create(slugA, { nombre: 'Centro' });
    await sucursalesService.create(slugA, { nombre: 'Norte' });
    await sucursalesService.create(slugB, { nombre: 'Centro' });
    await sucursalesService.create(slugB, { nombre: 'Sur' });

    const branchesA = await sucursalesService.findAll(slugA);
    const branchesB = await sucursalesService.findAll(slugB);

    expect(branchesA.map(({ nombre }) => nombre).sort()).toEqual([
      'Centro',
      'Norte',
    ]);
    expect(branchesB.map(({ nombre }) => nombre).sort()).toEqual([
      'Centro',
      'Sur',
    ]);

    await expect(
      sucursalesService.findOne(slugB, aCentro.id),
    ).rejects.toBeInstanceOf(NotFoundException);

    const tenantA = await tenantResolver.resolveBySlug(slugA);
    const currentSchema = await tenantContext.run(tenantA, async (manager) => {
      const rows = (await manager.query(
        'SELECT current_schema() AS schema',
      )) as Array<{
        schema: string;
      }>;
      return rows[0]?.schema;
    });

    expect(currentSchema).toBe(tenantA.schemaName);

    const sessionRows = (await dataSource.query(
      "SELECT current_schema() AS schema, current_setting('search_path') AS search_path",
    )) as Array<{ schema: string; search_path: string }>;

    expect(sessionRows[0]?.schema).toBe('public');
    expect(sessionRows[0]?.search_path).not.toContain('tenant_');
  });
});
