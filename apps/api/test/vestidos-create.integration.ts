import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { Empresa } from '../src/empresas/entities/empresa.entity.js';
import { EmpresasService } from '../src/empresas/empresas.service.js';
import { quoteTenantSchemaName } from '../src/empresas/tenant-schema-name.js';
import { SucursalesService } from '../src/sucursales/sucursales.service.js';
import { TenantResolverService } from '../src/tenancy/tenant-resolver.service.js';
import type { TenantScope } from '../src/tenancy/tenant-scope.js';
import { VestidoEstadoOperativo } from '../src/vestidos/entities/vestido.tenant-entity.js';
import { VestidosService } from '../src/vestidos/vestidos.service.js';

describe('PostgreSQL vestidos creation', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let empresasService: EmpresasService;
  let sucursalesService: SucursalesService;
  let tenantResolver: TenantResolverService;
  let vestidosService: VestidosService;
  let tenantA: TenantScope;
  let tenantB: TenantScope;
  let sucursalAId: string;
  let sucursalBId: string;

  const suffix = `${process.pid}-${Date.now()}`;
  const slugA = `vestidos-create-a-${suffix}`;
  const slugB = `vestidos-create-b-${suffix}`;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await moduleRef.init();

    dataSource = moduleRef.get(DataSource);
    empresasService = moduleRef.get(EmpresasService);
    sucursalesService = moduleRef.get(SucursalesService);
    tenantResolver = moduleRef.get(TenantResolverService);
    vestidosService = moduleRef.get(VestidosService);

    const empresaA = await empresasService.create({
      nombre: 'Vestidos Create A',
      slug: slugA,
    });
    const empresaB = await empresasService.create({
      nombre: 'Vestidos Create B',
      slug: slugB,
    });
    tenantA = await tenantResolver.resolveByEmpresaId(empresaA.id);
    tenantB = await tenantResolver.resolveByEmpresaId(empresaB.id);
    sucursalAId = (
      await sucursalesService.create(tenantA, { nombre: 'Centro A' })
    ).id;
    sucursalBId = (
      await sucursalesService.create(tenantB, { nombre: 'Centro B' })
    ).id;
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

  it('allows the same normalized code in different tenants', async () => {
    const inputA = createInput(sucursalAId, 'V-001');
    const inputB = createInput(sucursalBId, 'V-001');

    await expect(
      vestidosService.create(tenantA, inputA),
    ).resolves.toMatchObject({
      codigo: 'V-001',
      sucursalId: sucursalAId,
    });
    await expect(
      vestidosService.create(tenantB, inputB),
    ).resolves.toMatchObject({
      codigo: 'V-001',
      sucursalId: sucursalBId,
    });
  });

  it('returns 409 for duplicate and concurrent codes inside one tenant', async () => {
    await expect(
      vestidosService.create(tenantA, createInput(sucursalAId, 'V-001')),
    ).rejects.toBeInstanceOf(ConflictException);

    const concurrentResults = await Promise.allSettled([
      vestidosService.create(
        tenantA,
        createInput(sucursalAId, 'V-CONCURRENT', 'Vestido Concurrente A'),
      ),
      vestidosService.create(
        tenantA,
        createInput(sucursalAId, 'V-CONCURRENT', 'Vestido Concurrente B'),
      ),
    ]);
    expect(
      concurrentResults.filter(({ status }) => status === 'fulfilled'),
    ).toHaveLength(1);
    const rejection = concurrentResults.find(
      ({ status }) => status === 'rejected',
    );
    expect(rejection).toMatchObject({
      status: 'rejected',
      reason: expect.any(ConflictException),
    });
  });

  it('returns 404 for a branch from another tenant or an inactive branch', async () => {
    await expect(
      vestidosService.create(
        tenantA,
        createInput(sucursalBId, 'V-CROSS', 'Sucursal cruzada'),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    await sucursalesService.deactivate(tenantA, sucursalAId);
    await expect(
      vestidosService.create(
        tenantA,
        createInput(sucursalAId, 'V-INACTIVE', 'Sucursal inactiva'),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

function createInput(
  sucursalId: string,
  codigo: string,
  nombre = 'Vestido Azul',
) {
  return {
    sucursalId,
    codigo,
    nombre,
    talla: 'M',
    color: 'Azul',
    precioRenta: '1250.50',
    estadoOperativo: VestidoEstadoOperativo.DISPONIBLE,
  };
}
