import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { Cliente } from '../src/clientes/entities/cliente.tenant-entity.js';
import { ClientesService } from '../src/clientes/clientes.service.js';
import { AppModule } from '../src/app.module.js';
import { Empresa } from '../src/empresas/entities/empresa.entity.js';
import { EmpresasService } from '../src/empresas/empresas.service.js';
import { quoteTenantSchemaName } from '../src/empresas/tenant-schema-name.js';
import { ReservacionEstado } from '../src/reservaciones/entities/reservacion.tenant-entity.js';
import { ReservacionesService } from '../src/reservaciones/reservaciones.service.js';
import { Sucursal } from '../src/sucursales/entities/sucursal.tenant-entity.js';
import { SucursalesService } from '../src/sucursales/sucursales.service.js';
import { TenantResolverService } from '../src/tenancy/tenant-resolver.service.js';
import type { TenantScope } from '../src/tenancy/tenant-scope.js';
import {
  Vestido,
  VestidoEstadoOperativo,
} from '../src/vestidos/entities/vestido.tenant-entity.js';
import { VestidosService } from '../src/vestidos/vestidos.service.js';

describe('PostgreSQL dress availability', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let empresasService: EmpresasService;
  let clientesService: ClientesService;
  let sucursalesService: SucursalesService;
  let vestidosService: VestidosService;
  let reservacionesService: ReservacionesService;
  let tenantResolver: TenantResolverService;
  let tenantA: TenantScope;
  let tenantB: TenantScope;
  let clienteA: Cliente;
  let sucursalA: Sucursal;
  let sucursalAFilter: Sucursal;
  let sucursalB: Sucursal;
  let sequence = 0;

  const suffix = `${process.pid}-${Date.now()}`;
  const slugA = `availability-a-${suffix}`;
  const slugB = `availability-b-${suffix}`;
  const fechaInicio = new Date('2027-06-10T16:00:00.000Z');
  const fechaFin = new Date('2027-06-12T16:00:00.000Z');

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await moduleRef.init();

    dataSource = moduleRef.get(DataSource);
    empresasService = moduleRef.get(EmpresasService);
    clientesService = moduleRef.get(ClientesService);
    sucursalesService = moduleRef.get(SucursalesService);
    vestidosService = moduleRef.get(VestidosService);
    reservacionesService = moduleRef.get(ReservacionesService);
    tenantResolver = moduleRef.get(TenantResolverService);

    const empresaA = await empresasService.create({
      nombre: 'Availability A',
      slug: slugA,
    });
    const empresaB = await empresasService.create({
      nombre: 'Availability B',
      slug: slugB,
    });
    tenantA = await tenantResolver.resolveByEmpresaId(empresaA.id);
    tenantB = await tenantResolver.resolveByEmpresaId(empresaB.id);
    clienteA = await clientesService.create(tenantA, {
      nombre: 'Cliente Availability',
      email: 'availability@example.com',
    });
    sucursalA = await sucursalesService.create(tenantA, {
      nombre: 'Availability Centro',
    });
    sucursalAFilter = await sucursalesService.create(tenantA, {
      nombre: 'Availability Filtros',
    });
    sucursalB = await sucursalesService.create(tenantB, {
      nombre: 'Availability B',
    });
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

  async function createDress(
    tenant: TenantScope,
    sucursal: Sucursal,
    values: Partial<Pick<Vestido, 'talla' | 'color' | 'estadoOperativo'>> = {},
  ): Promise<Vestido> {
    sequence += 1;
    return vestidosService.create(tenant, {
      sucursalId: sucursal.id,
      codigo: `AVL-${sequence}`,
      nombre: `Disponibilidad ${sequence}`,
      talla: values.talla ?? 'M',
      color: values.color ?? 'Azul',
      precioRenta: '100.00',
      deposito: '20.00',
      estadoOperativo:
        values.estadoOperativo ?? VestidoEstadoOperativo.DISPONIBLE,
    });
  }

  async function reserve(
    vestido: Vestido,
    start: Date,
    end: Date,
    confirmar = true,
  ) {
    return reservacionesService.create(tenantA, {
      clienteId: clienteA.id,
      sucursalId: vestido.sucursalId,
      vestidoIds: [vestido.id],
      fechaInicio: start,
      fechaFin: end,
      confirmar,
    });
  }

  async function setReservationState(
    reservationId: string,
    estado: ReservacionEstado,
  ): Promise<void> {
    const schema = quoteTenantSchemaName(tenantA.schemaName);
    await dataSource.query(
      `UPDATE ${schema}."reservaciones" SET "estado" = $1 WHERE "id" = $2`,
      [estado, reservationId],
    );
  }

  it('applies blocking states and semi-open overlap rules without modifying reservations', async () => {
    const free = await createDress(tenantA, sucursalA);
    const confirmed = await createDress(tenantA, sucursalA);
    const delivered = await createDress(tenantA, sucursalA);
    const draft = await createDress(tenantA, sucursalA);
    const cancelled = await createDress(tenantA, sucursalA);
    const returned = await createDress(tenantA, sucursalA);
    const contiguousBefore = await createDress(tenantA, sucursalA);
    const contiguousAfter = await createDress(tenantA, sucursalA);
    const partial = await createDress(tenantA, sucursalA);
    const total = await createDress(tenantA, sucursalA);

    await reserve(
      confirmed,
      new Date('2027-06-09T16:00:00.000Z'),
      new Date('2027-06-13T16:00:00.000Z'),
    );
    const deliveredReservation = await reserve(
      delivered,
      new Date('2027-06-11T16:00:00.000Z'),
      new Date('2027-06-14T16:00:00.000Z'),
    );
    await setReservationState(
      deliveredReservation.id,
      ReservacionEstado.ENTREGADA,
    );
    await reserve(draft, fechaInicio, fechaFin, false);
    const cancelledReservation = await reserve(
      cancelled,
      fechaInicio,
      fechaFin,
    );
    await setReservationState(
      cancelledReservation.id,
      ReservacionEstado.CANCELADA,
    );
    const returnedReservation = await reserve(returned, fechaInicio, fechaFin);
    await setReservationState(
      returnedReservation.id,
      ReservacionEstado.DEVUELTA,
    );
    await reserve(
      contiguousBefore,
      new Date('2027-06-08T16:00:00.000Z'),
      fechaInicio,
    );
    await reserve(
      contiguousAfter,
      fechaFin,
      new Date('2027-06-13T16:00:00.000Z'),
    );
    await reserve(
      partial,
      new Date('2027-06-09T16:00:00.000Z'),
      new Date('2027-06-11T16:00:00.000Z'),
    );
    await reserve(
      total,
      new Date('2027-06-10T18:00:00.000Z'),
      new Date('2027-06-11T18:00:00.000Z'),
    );

    const schema = quoteTenantSchemaName(tenantA.schemaName);
    const before = (await dataSource.query(
      `SELECT COUNT(*)::integer AS "count" FROM ${schema}."reservaciones"`,
    )) as Array<{ count: number }>;
    const result = await vestidosService.findAvailability(tenantA, {
      sucursalId: sucursalA.id,
      fechaInicio,
      fechaFin,
      estadoOperativo: VestidoEstadoOperativo.DISPONIBLE,
      page: 1,
      limit: 100,
    });
    const after = (await dataSource.query(
      `SELECT COUNT(*)::integer AS "count" FROM ${schema}."reservaciones"`,
    )) as Array<{ count: number }>;
    const ids = new Set(result.data.map(({ id }) => id));

    for (const expected of [
      free,
      draft,
      cancelled,
      returned,
      contiguousBefore,
      contiguousAfter,
    ]) {
      expect(ids.has(expected.id)).toBe(true);
    }
    for (const blocked of [confirmed, delivered, partial, total]) {
      expect(ids.has(blocked.id)).toBe(false);
    }
    expect(result.range).toEqual({ fechaInicio, fechaFin });
    expect(after).toEqual(before);
    expect(JSON.stringify(result)).not.toContain('schemaName');
    expect(JSON.stringify(result)).not.toContain('tenant_');
  });

  it('filters by branch, size, color and operational state with stable pagination', async () => {
    const blueM = await createDress(tenantA, sucursalAFilter, {
      talla: 'M',
      color: 'Azul',
    });
    await createDress(tenantA, sucursalAFilter, { talla: 'G', color: 'Rojo' });
    await createDress(tenantA, sucursalAFilter, { talla: 'G', color: 'Rojo' });
    const maintenance = await createDress(tenantA, sucursalAFilter, {
      talla: 'G',
      color: 'Rojo',
      estadoOperativo: VestidoEstadoOperativo.MANTENIMIENTO,
    });
    const inactive = await createDress(tenantA, sucursalAFilter);
    await vestidosService.deactivate(tenantA, inactive.id);
    const foreign = await createDress(tenantB, sucursalB, {
      talla: 'M',
      color: 'Azul',
    });

    const filtered = await vestidosService.findAvailability(tenantA, {
      sucursalId: sucursalAFilter.id,
      fechaInicio,
      fechaFin,
      talla: 'm',
      color: 'azul',
      estadoOperativo: VestidoEstadoOperativo.DISPONIBLE,
      page: 1,
      limit: 20,
    });
    expect(filtered.data).toEqual([
      expect.objectContaining({ id: blueM.id, talla: 'M', color: 'Azul' }),
    ]);
    expect(filtered.data.map(({ id }) => id)).not.toContain(foreign.id);
    expect(filtered.data.map(({ id }) => id)).not.toContain(inactive.id);

    const paginated = await vestidosService.findAvailability(tenantA, {
      sucursalId: sucursalAFilter.id,
      fechaInicio,
      fechaFin,
      estadoOperativo: VestidoEstadoOperativo.DISPONIBLE,
      page: 1,
      limit: 2,
    });
    expect(paginated.data).toHaveLength(2);
    expect(paginated.pagination).toEqual({
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
    });

    const maintenanceResult = await vestidosService.findAvailability(tenantA, {
      sucursalId: sucursalAFilter.id,
      fechaInicio,
      fechaFin,
      estadoOperativo: VestidoEstadoOperativo.MANTENIMIENTO,
      page: 1,
      limit: 20,
    });
    expect(maintenanceResult.data).toEqual([
      expect.objectContaining({
        id: maintenance.id,
        estadoOperativo: VestidoEstadoOperativo.MANTENIMIENTO,
      }),
    ]);
  });

  it('returns 404 for inactive or foreign branches and leaves pooled search_path clean', async () => {
    const inactiveBranch = await sucursalesService.create(tenantA, {
      nombre: 'Availability Inactiva',
    });
    await sucursalesService.deactivate(tenantA, inactiveBranch.id);

    for (const branchId of [inactiveBranch.id, sucursalB.id]) {
      await expect(
        vestidosService.findAvailability(tenantA, {
          sucursalId: branchId,
          fechaInicio,
          fechaFin,
          estadoOperativo: VestidoEstadoOperativo.DISPONIBLE,
          page: 1,
          limit: 20,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    }

    const poolState = (await dataSource.query(
      `SELECT current_schema() AS "schema", current_setting('search_path') AS "searchPath"`,
    )) as Array<{ schema: string; searchPath: string }>;
    expect(poolState[0]?.schema).toBe('public');
    expect(poolState[0]?.searchPath).not.toContain('tenant_');
  });
});
