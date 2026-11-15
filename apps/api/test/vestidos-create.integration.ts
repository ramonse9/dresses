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

  it('paginates, filters, searches and joins the branch without tenant data', async () => {
    const sucursalNorte = await sucursalesService.create(tenantA, {
      nombre: 'Norte A',
    });
    const maintenance = await vestidosService.create(tenantA, {
      ...createInput(sucursalAId, 'V-GALA', 'Gala Roja'),
      marca: 'Luna',
      estadoOperativo: VestidoEstadoOperativo.MANTENIMIENTO,
    });
    await vestidosService.create(
      tenantA,
      createInput(sucursalNorte.id, 'V-NORTH', 'Vestido Norte'),
    );
    const inactive = await vestidosService.create(
      tenantA,
      createInput(sucursalAId, 'V-INACTIVE-CATALOG', 'Vestido Archivado'),
    );
    await dataSource.query(
      `UPDATE ${quoteTenantSchemaName(tenantA.schemaName)}."vestidos" SET "activo" = false WHERE "id" = $1`,
      [inactive.id],
    );

    const firstPage = await vestidosService.findAll(tenantA, {
      page: 1,
      limit: 2,
    });
    const secondPage = await vestidosService.findAll(tenantA, {
      page: 2,
      limit: 2,
    });
    expect(firstPage.pagination).toMatchObject({
      page: 1,
      limit: 2,
      total: 5,
      totalPages: 3,
    });
    expect(firstPage.data).toHaveLength(2);
    expect(secondPage.data).toHaveLength(2);
    expect(secondPage.data.map(({ id }) => id)).not.toEqual(
      firstPage.data.map(({ id }) => id),
    );

    await expect(
      vestidosService.findAll(tenantA, {
        page: 1,
        limit: 20,
        sucursalId: sucursalNorte.id,
      }),
    ).resolves.toMatchObject({
      data: [expect.objectContaining({ codigo: 'V-NORTH' })],
      pagination: { total: 1 },
    });
    await expect(
      vestidosService.findAll(tenantA, {
        page: 1,
        limit: 20,
        activo: false,
      }),
    ).resolves.toMatchObject({
      data: [expect.objectContaining({ id: inactive.id })],
      pagination: { total: 1 },
    });
    await expect(
      vestidosService.findAll(tenantA, {
        page: 1,
        limit: 20,
        estadoOperativo: VestidoEstadoOperativo.MANTENIMIENTO,
      }),
    ).resolves.toMatchObject({
      data: [expect.objectContaining({ id: maintenance.id })],
      pagination: { total: 1 },
    });

    for (const q of ['V-GALA', 'Gala Roja', 'Luna']) {
      const search = await vestidosService.findAll(tenantA, {
        page: 1,
        limit: 20,
        q,
      });
      expect(search.data).toEqual([
        expect.objectContaining({ id: maintenance.id }),
      ]);
    }

    const detail = await vestidosService.findOne(tenantA, maintenance.id);
    expect(detail).toMatchObject({
      id: maintenance.id,
      sucursal: { id: sucursalAId, nombre: 'Centro A', activo: true },
    });
    expect(JSON.stringify(detail)).not.toContain('tenant_');
    expect(JSON.stringify(detail)).not.toContain('schemaName');
    await expect(
      vestidosService.findOne(tenantB, maintenance.id),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates, transfers, reactivates and soft-deletes only inside its tenant', async () => {
    const destination = await sucursalesService.create(tenantA, {
      nombre: 'Traslados A',
    });
    const inactiveDestination = await sucursalesService.create(tenantA, {
      nombre: 'Inactiva A',
    });
    const vestido = await vestidosService.create(
      tenantA,
      createInput(sucursalAId, 'V-MUTATION', 'Vestido Original'),
    );

    const deactivated = await vestidosService.deactivate(tenantA, vestido.id);
    expect(deactivated.activo).toBe(false);
    const persistedAfterDelete = await vestidosService.findOne(
      tenantA,
      vestido.id,
    );
    expect(persistedAfterDelete).toMatchObject({
      id: vestido.id,
      activo: false,
    });

    const updated = await vestidosService.update(tenantA, vestido.id, {
      sucursalId: destination.id,
      codigo: 'V-MOVED',
      nombre: 'Vestido Trasladado',
      descripcion: 'Actualizado',
      talla: 'L',
      color: 'Rojo',
      marca: 'Luna',
      precioRenta: '1750.00',
      deposito: '300.00',
      estadoOperativo: VestidoEstadoOperativo.MANTENIMIENTO,
      activo: true,
    });
    expect(updated).toMatchObject({
      sucursalId: destination.id,
      codigo: 'V-MOVED',
      nombre: 'Vestido Trasladado',
      descripcion: 'Actualizado',
      talla: 'L',
      color: 'Rojo',
      marca: 'Luna',
      precioRenta: '1750.00',
      deposito: '300.00',
      estadoOperativo: VestidoEstadoOperativo.MANTENIMIENTO,
      activo: true,
    });

    await expect(
      vestidosService.update(tenantA, vestido.id, { codigo: 'V-001' }),
    ).rejects.toBeInstanceOf(ConflictException);

    await sucursalesService.deactivate(tenantA, inactiveDestination.id);
    await expect(
      vestidosService.update(tenantA, vestido.id, {
        sucursalId: inactiveDestination.id,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      vestidosService.update(tenantB, vestido.id, { nombre: 'Cruce' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      vestidosService.deactivate(tenantB, vestido.id),
    ).rejects.toBeInstanceOf(NotFoundException);

    const persisted = await vestidosService.findOne(tenantA, vestido.id);
    expect(persisted).toMatchObject({
      codigo: 'V-MOVED',
      sucursalId: destination.id,
      activo: true,
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
