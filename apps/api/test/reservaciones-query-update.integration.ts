import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { Cliente } from '../src/clientes/entities/cliente.tenant-entity.js';
import { ClientesService } from '../src/clientes/clientes.service.js';
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

describe('PostgreSQL reservation queries and controlled updates', () => {
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
  let sequence = 0;

  const suffix = `${process.pid}-${Date.now()}`;
  const slugA = `reservation-query-a-${suffix}`;
  const slugB = `reservation-query-b-${suffix}`;

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
      nombre: 'Reservation Query A',
      slug: slugA,
    });
    const empresaB = await empresasService.create({
      nombre: 'Reservation Query B',
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

  async function createCliente(
    tenant: TenantScope,
    name: string,
  ): Promise<Cliente> {
    sequence += 1;
    return clientesService.create(tenant, {
      nombre: name,
      email: `reservation-${sequence}@example.com`,
      telefono: `555-${String(sequence).padStart(4, '0')}`,
    });
  }

  async function createSucursal(
    tenant: TenantScope,
    name: string,
  ): Promise<Sucursal> {
    return sucursalesService.create(tenant, { nombre: name });
  }

  async function createDress(
    tenant: TenantScope,
    sucursal: Sucursal,
    price = '100.00',
    deposit: string | null = '20.00',
  ): Promise<Vestido> {
    sequence += 1;
    return vestidosService.create(tenant, {
      sucursalId: sucursal.id,
      codigo: `QR-${sequence}`,
      nombre: `Query Dress ${sequence}`,
      talla: 'M',
      color: 'Azul',
      precioRenta: price,
      deposito: deposit,
      estadoOperativo: VestidoEstadoOperativo.DISPONIBLE,
    });
  }

  async function createReservation(
    tenant: TenantScope,
    cliente: Cliente,
    sucursal: Sucursal,
    vestidos: Vestido[],
    values: Partial<{
      fechaInicio: Date;
      fechaFin: Date;
      confirmar: boolean;
      notas: string;
    }> = {},
  ) {
    return reservacionesService.create(tenant, {
      clienteId: cliente.id,
      sucursalId: sucursal.id,
      vestidoIds: vestidos.map(({ id }) => id),
      fechaInicio: values.fechaInicio ?? new Date('2027-08-10T16:00:00.000Z'),
      fechaFin: values.fechaFin ?? new Date('2027-08-12T16:00:00.000Z'),
      confirmar: values.confirmar ?? false,
      notas: values.notas,
    });
  }

  async function setState(
    tenant: TenantScope,
    id: string,
    estado: ReservacionEstado,
  ): Promise<void> {
    await dataSource.query(
      `UPDATE ${quoteTenantSchemaName(tenant.schemaName)}."reservaciones" SET "estado" = $1 WHERE "id" = $2`,
      [estado, id],
    );
  }

  it('lists, paginates, searches and filters overlapping reservations without N+1 data loss', async () => {
    const clienteAna = await createCliente(tenantA, 'Ana Consulta');
    const clienteBea = await createCliente(tenantA, 'Beatriz Consulta');
    const sucursal = await createSucursal(tenantA, 'Listado Centro');
    const otherSucursal = await createSucursal(tenantA, 'Listado Norte');
    const dressA = await createDress(tenantA, sucursal);
    const dressB = await createDress(tenantA, sucursal);
    const dressC = await createDress(tenantA, otherSucursal);
    const first = await createReservation(
      tenantA,
      clienteAna,
      sucursal,
      [dressA, dressB],
      { confirmar: true, notas: 'Primera' },
    );
    await createReservation(tenantA, clienteBea, sucursal, [dressB], {
      fechaInicio: new Date('2027-09-01T16:00:00.000Z'),
      fechaFin: new Date('2027-09-03T16:00:00.000Z'),
      confirmar: false,
    });
    await createReservation(tenantA, clienteAna, otherSucursal, [dressC], {
      fechaInicio: new Date('2027-10-01T16:00:00.000Z'),
      fechaFin: new Date('2027-10-03T16:00:00.000Z'),
      confirmar: false,
    });

    const page = await reservacionesService.findAll(tenantA, {
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

    const filtered = await reservacionesService.findAll(tenantA, {
      page: 1,
      limit: 20,
      clienteId: clienteAna.id,
      sucursalId: sucursal.id,
      estado: ReservacionEstado.CONFIRMADA,
      fechaDesde: new Date('2027-08-11T16:00:00.000Z'),
      fechaHasta: new Date('2027-08-13T16:00:00.000Z'),
      q: clienteAna.email!.toUpperCase(),
    });
    expect(filtered.data).toEqual([
      expect.objectContaining({
        id: first.id,
        vestidosCount: 2,
        cliente: expect.objectContaining({ id: clienteAna.id }),
        sucursal: expect.objectContaining({ id: sucursal.id }),
      }),
    ]);
    expect(JSON.stringify(filtered)).not.toContain('schemaName');
    expect(JSON.stringify(filtered)).not.toContain('tenant_');

    for (const q of [
      clienteAna.nombre,
      clienteAna.email!,
      clienteAna.telefono!,
    ]) {
      const result = await reservacionesService.findAll(tenantA, {
        page: 1,
        limit: 20,
        q,
      });
      expect(
        result.data.some(({ cliente }) => cliente.id === clienteAna.id),
      ).toBe(true);
    }
  });

  it('returns complete details and 404 across tenants', async () => {
    const clienteA = await createCliente(tenantA, 'Detalle A');
    const clienteB = await createCliente(tenantB, 'Detalle B');
    const sucursalA = await createSucursal(tenantA, 'Detalle A');
    const sucursalB = await createSucursal(tenantB, 'Detalle B');
    const vestidoA = await createDress(tenantA, sucursalA, '321.50', '80.00');
    const vestidoB = await createDress(tenantB, sucursalB);
    const reservationA = await createReservation(
      tenantA,
      clienteA,
      sucursalA,
      [vestidoA],
      { confirmar: true, notas: 'Detalle completo' },
    );
    const reservationB = await createReservation(tenantB, clienteB, sucursalB, [
      vestidoB,
    ]);

    await expect(
      reservacionesService.findOne(tenantA, reservationA.id),
    ).resolves.toMatchObject({
      id: reservationA.id,
      cliente: { id: clienteA.id },
      sucursal: { id: sucursalA.id },
      estado: ReservacionEstado.CONFIRMADA,
      notas: 'Detalle completo',
      importeRenta: '321.50',
      depositoRequerido: '80.00',
      confirmadaAt: expect.any(Date),
      entregadaAt: null,
      devueltaAt: null,
      canceladaAt: null,
      vestidos: expect.arrayContaining([
        expect.objectContaining({
          id: vestidoA.id,
          precioRenta: '321.50',
          deposito: '80.00',
        }),
      ]),
    });
    await expect(
      reservacionesService.findOne(tenantA, reservationB.id),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      reservacionesService.update(tenantA, reservationB.id, { notas: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates drafts, moves branches, preserves snapshots and recalculates totals', async () => {
    const clienteOriginal = await createCliente(tenantA, 'Original');
    const clienteNuevo = await createCliente(tenantA, 'Nuevo');
    const sucursalOriginal = await createSucursal(tenantA, 'Update Original');
    const sucursalNueva = await createSucursal(tenantA, 'Update Nueva');
    const oldDress = await createDress(
      tenantA,
      sucursalOriginal,
      '100.00',
      '10.00',
    );
    const reservation = await createReservation(
      tenantA,
      clienteOriginal,
      sucursalOriginal,
      [oldDress],
      { notas: 'Original' },
    );

    await expect(
      reservacionesService.update(tenantA, reservation.id, {
        notas: 'Sólo notas',
      }),
    ).resolves.toMatchObject({ notas: 'Sólo notas' });
    await vestidosService.update(tenantA, oldDress.id, {
      precioRenta: '999.00',
      deposito: '99.00',
      sucursalId: sucursalNueva.id,
    });
    const newDress = await createDress(
      tenantA,
      sucursalNueva,
      '200.00',
      '20.00',
    );
    const updated = await reservacionesService.update(tenantA, reservation.id, {
      clienteId: clienteNuevo.id,
      sucursalId: sucursalNueva.id,
      vestidoIds: [oldDress.id, newDress.id],
      fechaInicio: new Date('2027-08-11T16:00:00.000Z'),
      fechaFin: new Date('2027-08-13T16:00:00.000Z'),
    });

    expect(updated).toMatchObject({
      cliente: { id: clienteNuevo.id },
      sucursal: { id: sucursalNueva.id },
      fechaInicio: new Date('2027-08-11T16:00:00.000Z'),
      fechaFin: new Date('2027-08-13T16:00:00.000Z'),
      importeRenta: '300.00',
      depositoRequerido: '30.00',
      vestidos: expect.arrayContaining([
        expect.objectContaining({
          id: oldDress.id,
          precioRenta: '100.00',
          deposito: '10.00',
        }),
        expect.objectContaining({
          id: newDress.id,
          precioRenta: '200.00',
          deposito: '20.00',
        }),
      ]),
    });
  });

  it('allows overlapping draft updates and rejects confirmed conflicts', async () => {
    const cliente = await createCliente(tenantA, 'Conflictos');
    const sucursal = await createSucursal(tenantA, 'Conflictos');
    const freeDress = await createDress(tenantA, sucursal);
    const blockedDress = await createDress(tenantA, sucursal);
    const draft = await createReservation(tenantA, cliente, sucursal, [
      freeDress,
    ]);
    await createReservation(tenantA, cliente, sucursal, [blockedDress], {
      confirmar: true,
    });

    await expect(
      reservacionesService.update(tenantA, draft.id, {
        vestidoIds: [blockedDress.id],
      }),
    ).resolves.toMatchObject({
      estado: ReservacionEstado.BORRADOR,
      vestidos: [expect.objectContaining({ id: blockedDress.id })],
    });

    const confirmedOwnDress = await createDress(tenantA, sucursal);
    const confirmed = await createReservation(
      tenantA,
      cliente,
      sucursal,
      [confirmedOwnDress],
      { confirmar: true },
    );
    await expect(
      reservacionesService.update(tenantA, confirmed.id, {
        vestidoIds: [confirmedOwnDress.id, blockedDress.id],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      reservacionesService.update(tenantA, confirmed.id, {
        fechaInicio: new Date('2027-08-11T16:00:00.000Z'),
        fechaFin: new Date('2027-08-13T16:00:00.000Z'),
      }),
    ).resolves.toMatchObject({ id: confirmed.id });
  });

  it('serializes concurrent confirmed updates competing for the same dress', async () => {
    const cliente = await createCliente(tenantA, 'Concurrente');
    const sucursal = await createSucursal(tenantA, 'Concurrente');
    const ownA = await createDress(tenantA, sucursal);
    const ownB = await createDress(tenantA, sucursal);
    const shared = await createDress(tenantA, sucursal);
    const reservationA = await createReservation(
      tenantA,
      cliente,
      sucursal,
      [ownA],
      { confirmar: true },
    );
    const reservationB = await createReservation(
      tenantA,
      cliente,
      sucursal,
      [ownB],
      { confirmar: true },
    );
    const results = await Promise.allSettled([
      reservacionesService.update(tenantA, reservationA.id, {
        vestidoIds: [ownA.id, shared.id],
      }),
      reservacionesService.update(tenantA, reservationB.id, {
        vestidoIds: [ownB.id, shared.id],
      }),
    ]);

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(results.find(({ status }) => status === 'rejected')).toMatchObject({
      status: 'rejected',
      reason: expect.any(ConflictException),
    });
  });

  it('serializes concurrent date updates for two confirmed reservations', async () => {
    const cliente = await createCliente(tenantA, 'Fechas concurrentes');
    const sucursal = await createSucursal(tenantA, 'Fechas concurrentes');
    const shared = await createDress(tenantA, sucursal);
    const reservationA = await createReservation(
      tenantA,
      cliente,
      sucursal,
      [shared],
      {
        fechaInicio: new Date('2027-11-01T16:00:00.000Z'),
        fechaFin: new Date('2027-11-02T16:00:00.000Z'),
        confirmar: true,
      },
    );
    const reservationB = await createReservation(
      tenantA,
      cliente,
      sucursal,
      [shared],
      {
        fechaInicio: new Date('2027-11-04T16:00:00.000Z'),
        fechaFin: new Date('2027-11-05T16:00:00.000Z'),
        confirmar: true,
      },
    );
    const targetRange = {
      fechaInicio: new Date('2027-11-10T16:00:00.000Z'),
      fechaFin: new Date('2027-11-12T16:00:00.000Z'),
    };
    const results = await Promise.allSettled([
      reservacionesService.update(tenantA, reservationA.id, targetRange),
      reservacionesService.update(tenantA, reservationB.id, targetRange),
    ]);

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(results.find(({ status }) => status === 'rejected')).toMatchObject({
      status: 'rejected',
      reason: expect.any(ConflictException),
    });
  });

  it.each([
    ReservacionEstado.ENTREGADA,
    ReservacionEstado.DEVUELTA,
    ReservacionEstado.CANCELADA,
  ])('rejects updates while state is %s', async (estado) => {
    const cliente = await createCliente(tenantA, `Estado ${estado}`);
    const sucursal = await createSucursal(tenantA, `Estado ${estado}`);
    const vestido = await createDress(tenantA, sucursal);
    const reservation = await createReservation(tenantA, cliente, sucursal, [
      vestido,
    ]);
    await setState(tenantA, reservation.id, estado);

    await expect(
      reservacionesService.update(tenantA, reservation.id, { notas: 'x' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('leaves reused pooled connections in public', async () => {
    const state = (await dataSource.query(
      `SELECT current_schema() AS "schema", current_setting('search_path') AS "searchPath"`,
    )) as Array<{ schema: string; searchPath: string }>;
    expect(state[0]?.schema).toBe('public');
    expect(state[0]?.searchPath).not.toContain('tenant_');
  });
});
