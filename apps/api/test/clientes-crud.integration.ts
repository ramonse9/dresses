import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { ClientesService } from '../src/clientes/clientes.service.js';
import { Empresa } from '../src/empresas/entities/empresa.entity.js';
import { EmpresasService } from '../src/empresas/empresas.service.js';
import { quoteTenantSchemaName } from '../src/empresas/tenant-schema-name.js';
import { TenantResolverService } from '../src/tenancy/tenant-resolver.service.js';
import type { TenantScope } from '../src/tenancy/tenant-scope.js';

describe('PostgreSQL clientes CRUD isolation', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let empresasService: EmpresasService;
  let clientesService: ClientesService;
  let tenantResolver: TenantResolverService;
  let tenantA: TenantScope;
  let tenantB: TenantScope;
  let clienteAId: string;

  const suffix = `${process.pid}-${Date.now()}`;
  const slugA = `clientes-crud-a-${suffix}`;
  const slugB = `clientes-crud-b-${suffix}`;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await moduleRef.init();

    dataSource = moduleRef.get(DataSource);
    empresasService = moduleRef.get(EmpresasService);
    clientesService = moduleRef.get(ClientesService);
    tenantResolver = moduleRef.get(TenantResolverService);

    const empresaA = await empresasService.create({
      nombre: 'Clientes CRUD A',
      slug: slugA,
    });
    const empresaB = await empresasService.create({
      nombre: 'Clientes CRUD B',
      slug: slugB,
    });
    tenantA = await tenantResolver.resolveByEmpresaId(empresaA.id);
    tenantB = await tenantResolver.resolveByEmpresaId(empresaB.id);
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

  it('allows repeated contacts across tenants and normalizes persistence', async () => {
    const clienteA = await clientesService.create(tenantA, {
      nombre: '  Ana Norte  ',
      telefono: '  555-0100  ',
      email: '  SHARED@EXAMPLE.COM  ',
    });
    const clienteB = await clientesService.create(tenantB, {
      nombre: 'Ana Sur',
      telefono: '555-0100',
      email: 'shared@example.com',
    });
    clienteAId = clienteA.id;

    expect(clienteA).toMatchObject({
      nombre: 'Ana Norte',
      telefono: '555-0100',
      email: 'shared@example.com',
      activo: true,
    });
    expect(clienteB).toMatchObject({
      email: 'shared@example.com',
      activo: true,
    });
    expect(JSON.stringify([clienteA, clienteB])).not.toContain('tenant_');
    expect(JSON.stringify([clienteA, clienteB])).not.toContain('schemaName');
  });

  it('paginates, filters and searches by every supported field', async () => {
    await clientesService.create(tenantA, {
      nombre: 'Beatriz Centro',
      email: 'beatriz@example.com',
    });
    const inactive = await clientesService.create(tenantA, {
      nombre: 'Carla Poniente',
      telefono: '555-0300',
    });
    await clientesService.deactivate(tenantA, inactive.id);

    const page = await clientesService.findAll(tenantA, {
      page: 1,
      limit: 2,
    });
    expect(page.data).toHaveLength(2);
    expect(page.pagination).toEqual({
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
    });

    for (const q of ['Ana Norte', 'shared@example.com', '555-0100']) {
      const result = await clientesService.findAll(tenantA, {
        page: 1,
        limit: 20,
        q,
      });
      expect(result.data).toEqual([
        expect.objectContaining({ id: clienteAId }),
      ]);
    }

    await expect(
      clientesService.findAll(tenantA, {
        page: 1,
        limit: 20,
        activo: false,
      }),
    ).resolves.toMatchObject({
      data: [expect.objectContaining({ id: inactive.id, activo: false })],
      pagination: { total: 1 },
    });
  });

  it('updates contacts, validates final state and performs reversible soft deletion', async () => {
    await expect(
      clientesService.update(tenantA, clienteAId, {
        telefono: null,
        email: 'updated@example.com',
        direccion: 'Centro 123',
        notas: 'Actualizada',
      }),
    ).resolves.toMatchObject({
      telefono: null,
      email: 'updated@example.com',
      direccion: 'Centro 123',
      notas: 'Actualizada',
    });
    await expect(
      clientesService.update(tenantA, clienteAId, {
        telefono: null,
        email: null,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      clientesService.deactivate(tenantA, clienteAId),
    ).resolves.toMatchObject({ activo: false });
    await expect(
      clientesService.findOne(tenantA, clienteAId),
    ).resolves.toMatchObject({ id: clienteAId, activo: false });
    await expect(
      clientesService.updateEstado(tenantA, clienteAId, true),
    ).resolves.toMatchObject({ activo: true });
  });

  it('returns 404 across tenants and leaves pooled connections in public', async () => {
    await expect(
      clientesService.findOne(tenantB, clienteAId),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      clientesService.update(tenantB, clienteAId, { nombre: 'Cruce' }),
    ).rejects.toBeInstanceOf(NotFoundException);

    const poolState = (await dataSource.query(
      `SELECT current_schema() AS "schema", current_setting('search_path') AS "searchPath"`,
    )) as Array<{ schema: string; searchPath: string }>;
    expect(poolState[0]?.schema).toBe('public');
    expect(poolState[0]?.searchPath).not.toContain('tenant_');
  });
});
