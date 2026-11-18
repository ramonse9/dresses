import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
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

describe('PostgreSQL reservation lifecycle', () => {
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
  let clienteB: Cliente;
  let sucursalA: Sucursal;
  let sucursalB: Sucursal;
  let sequence = 0;

  const suffix = `${process.pid}-${Date.now()}`;
  const slugA = `reservation-life-a-${suffix}`;
  const slugB = `reservation-life-b-${suffix}`;

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
      nombre: 'Reservation Lifecycle A',
      slug: slugA,
    });
    const empresaB = await empresasService.create({
      nombre: 'Reservation Lifecycle B',
      slug: slugB,
    });
    tenantA = await tenantResolver.resolveByEmpresaId(empresaA.id);
    tenantB = await tenantResolver.resolveByEmpresaId(empresaB.id);
    clienteA = await clientesService.create(tenantA, {
      nombre: 'Lifecycle A',
      email: `lifecycle-a-${suffix}@example.com`,
    });
    clienteB = await clientesService.create(tenantB, {
      nombre: 'Lifecycle B',
      email: `lifecycle-b-${suffix}@example.com`,
    });
    sucursalA = await sucursalesService.create(tenantA, {
      nombre: 'Lifecycle Branch A',
    });
    sucursalB = await sucursalesService.create(tenantB, {
      nombre: 'Lifecycle Branch B',
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
  ): Promise<Vestido> {
    sequence += 1;
    return vestidosService.create(tenant, {
      sucursalId: sucursal.id,
      codigo: `LIFE-${sequence}`,
      nombre: `Lifecycle Dress ${sequence}`,
      talla: 'M',
      color: 'Azul',
      precioRenta: '500.00',
      deposito: '100.00',
      estadoOperativo: VestidoEstadoOperativo.DISPONIBLE,
    });
  }

  function createReservation(
    tenant: TenantScope,
    cliente: Cliente,
    sucursal: Sucursal,
    vestido: Vestido,
    confirmar = false,
  ) {
    return reservacionesService.create(tenant, {
      clienteId: cliente.id,
      sucursalId: sucursal.id,
      vestidoIds: [vestido.id],
      fechaInicio: new Date('2028-01-10T16:00:00.000Z'),
      fechaFin: new Date('2028-01-12T16:00:00.000Z'),
      confirmar,
    });
  }

  function availability(tenant: TenantScope, sucursal: Sucursal) {
    return vestidosService.findAvailability(tenant, {
      sucursalId: sucursal.id,
      fechaInicio: new Date('2028-01-10T16:00:00.000Z'),
      fechaFin: new Date('2028-01-12T16:00:00.000Z'),
      estadoOperativo: VestidoEstadoOperativo.DISPONIBLE,
      page: 1,
      limit: 100,
    });
  }

  it('runs BORRADOR → CONFIRMADA → ENTREGADA → DEVUELTA and updates availability', async () => {
    const vestido = await createDress(tenantA, sucursalA);
    const draft = await createReservation(
      tenantA,
      clienteA,
      sucursalA,
      vestido,
    );

    expect((await availability(tenantA, sucursalA)).data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: vestido.id })]),
    );

    const confirmed = await reservacionesService.confirm(tenantA, draft.id);
    expect(confirmed).toMatchObject({
      estado: ReservacionEstado.CONFIRMADA,
      confirmadaAt: expect.any(Date),
      entregadaAt: null,
    });
    expect(JSON.stringify(confirmed)).not.toContain('tenant_');
    expect((await availability(tenantA, sucursalA)).data).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: vestido.id })]),
    );

    const delivered = await reservacionesService.deliver(tenantA, draft.id);
    expect(delivered).toMatchObject({
      estado: ReservacionEstado.ENTREGADA,
      confirmadaAt: expect.any(Date),
      entregadaAt: expect.any(Date),
      devueltaAt: null,
    });
    await expect(
      vestidosService.findOne(tenantA, vestido.id),
    ).resolves.toMatchObject({
      estadoOperativo: VestidoEstadoOperativo.DISPONIBLE,
    });

    const returned = await reservacionesService.returnReservation(
      tenantA,
      draft.id,
    );
    expect(returned).toMatchObject({
      estado: ReservacionEstado.DEVUELTA,
      devueltaAt: expect.any(Date),
    });
    expect((await availability(tenantA, sucursalA)).data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: vestido.id })]),
    );
  });

  it('cancels drafts and confirmed reservations and releases availability', async () => {
    const draftDress = await createDress(tenantA, sucursalA);
    const draft = await createReservation(
      tenantA,
      clienteA,
      sucursalA,
      draftDress,
    );
    const cancelledDraft = await reservacionesService.cancel(
      tenantA,
      draft.id,
      { motivo: 'Cambio de planes' },
    );
    expect(cancelledDraft).toMatchObject({
      estado: ReservacionEstado.CANCELADA,
      canceladaAt: expect.any(Date),
      motivoCancelacion: 'Cambio de planes',
    });

    const confirmedDress = await createDress(tenantA, sucursalA);
    const confirmed = await createReservation(
      tenantA,
      clienteA,
      sucursalA,
      confirmedDress,
      true,
    );
    expect((await availability(tenantA, sucursalA)).data).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: confirmedDress.id }),
      ]),
    );
    await expect(
      reservacionesService.cancel(tenantA, confirmed.id, { motivo: null }),
    ).resolves.toMatchObject({
      estado: ReservacionEstado.CANCELADA,
      motivoCancelacion: null,
    });
    expect((await availability(tenantA, sucursalA)).data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: confirmedDress.id }),
      ]),
    );
  });

  it('rejects invalid jumps and treats DEVUELTA and CANCELADA as terminal', async () => {
    const draftDress = await createDress(tenantA, sucursalA);
    const draft = await createReservation(
      tenantA,
      clienteA,
      sucursalA,
      draftDress,
    );
    await expect(
      reservacionesService.deliver(tenantA, draft.id),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      reservacionesService.returnReservation(tenantA, draft.id),
    ).rejects.toBeInstanceOf(ConflictException);

    await reservacionesService.confirm(tenantA, draft.id);
    await expect(
      reservacionesService.confirm(tenantA, draft.id),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      reservacionesService.returnReservation(tenantA, draft.id),
    ).rejects.toBeInstanceOf(ConflictException);
    await reservacionesService.deliver(tenantA, draft.id);
    await expect(
      reservacionesService.cancel(tenantA, draft.id, { motivo: null }),
    ).rejects.toBeInstanceOf(ConflictException);
    await reservacionesService.returnReservation(tenantA, draft.id);

    for (const operation of [
      () => reservacionesService.confirm(tenantA, draft.id),
      () => reservacionesService.deliver(tenantA, draft.id),
      () => reservacionesService.returnReservation(tenantA, draft.id),
      () => reservacionesService.cancel(tenantA, draft.id, { motivo: null }),
    ]) {
      await expect(operation()).rejects.toBeInstanceOf(ConflictException);
    }

    const cancelledDress = await createDress(tenantA, sucursalA);
    const cancelled = await createReservation(
      tenantA,
      clienteA,
      sucursalA,
      cancelledDress,
    );
    await reservacionesService.cancel(tenantA, cancelled.id, { motivo: null });
    await expect(
      reservacionesService.confirm(tenantA, cancelled.id),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('revalidates active references and operational dresses before confirmation or delivery', async () => {
    const inactiveCliente = await clientesService.create(tenantA, {
      nombre: 'Inactive lifecycle client',
      email: `inactive-life-${suffix}@example.com`,
    });
    const clientDress = await createDress(tenantA, sucursalA);
    const clientDraft = await createReservation(
      tenantA,
      inactiveCliente,
      sucursalA,
      clientDress,
    );
    await clientesService.deactivate(tenantA, inactiveCliente.id);
    await expect(
      reservacionesService.confirm(tenantA, clientDraft.id),
    ).rejects.toBeInstanceOf(NotFoundException);

    const inactiveSucursal = await sucursalesService.create(tenantA, {
      nombre: `Inactive lifecycle branch ${sequence}`,
    });
    const branchDress = await createDress(tenantA, inactiveSucursal);
    const branchDraft = await createReservation(
      tenantA,
      clienteA,
      inactiveSucursal,
      branchDress,
    );
    await sucursalesService.deactivate(tenantA, inactiveSucursal.id);
    await expect(
      reservacionesService.confirm(tenantA, branchDraft.id),
    ).rejects.toBeInstanceOf(NotFoundException);

    const inactiveDress = await createDress(tenantA, sucursalA);
    const inactiveDraft = await createReservation(
      tenantA,
      clienteA,
      sucursalA,
      inactiveDress,
    );
    await vestidosService.deactivate(tenantA, inactiveDress.id);
    await expect(
      reservacionesService.confirm(tenantA, inactiveDraft.id),
    ).rejects.toBeInstanceOf(BadRequestException);

    const maintenanceDress = await createDress(tenantA, sucursalA);
    const confirmed = await createReservation(
      tenantA,
      clienteA,
      sucursalA,
      maintenanceDress,
      true,
    );
    await vestidosService.update(tenantA, maintenanceDress.id, {
      estadoOperativo: VestidoEstadoOperativo.MANTENIMIENTO,
    });
    await expect(
      reservacionesService.deliver(tenantA, confirmed.id),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects conflicts and serializes two confirmations for the same dress', async () => {
    const blockedDress = await createDress(tenantA, sucursalA);
    await createReservation(tenantA, clienteA, sucursalA, blockedDress, true);
    const conflictingDraft = await createReservation(
      tenantA,
      clienteA,
      sucursalA,
      blockedDress,
    );
    await expect(
      reservacionesService.confirm(tenantA, conflictingDraft.id),
    ).rejects.toBeInstanceOf(ConflictException);

    const concurrentDress = await createDress(tenantA, sucursalA);
    const [draftA, draftB] = await Promise.all([
      createReservation(tenantA, clienteA, sucursalA, concurrentDress),
      createReservation(tenantA, clienteA, sucursalA, concurrentDress),
    ]);
    const results = await Promise.allSettled([
      reservacionesService.confirm(tenantA, draftA.id),
      reservacionesService.confirm(tenantA, draftB.id),
    ]);

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(results.find(({ status }) => status === 'rejected')).toMatchObject({
      status: 'rejected',
      reason: expect.any(ConflictException),
    });
  });

  it('serializes two deliveries from the same confirmed state', async () => {
    const vestido = await createDress(tenantA, sucursalA);
    const confirmed = await createReservation(
      tenantA,
      clienteA,
      sucursalA,
      vestido,
      true,
    );
    const results = await Promise.allSettled([
      reservacionesService.deliver(tenantA, confirmed.id),
      reservacionesService.deliver(tenantA, confirmed.id),
    ]);

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(results.find(({ status }) => status === 'rejected')).toMatchObject({
      status: 'rejected',
      reason: expect.any(ConflictException),
    });
  });

  it('returns 404 across tenants and leaves pooled connections in public', async () => {
    const vestidoB = await createDress(tenantB, sucursalB);
    const reservationB = await createReservation(
      tenantB,
      clienteB,
      sucursalB,
      vestidoB,
    );

    await expect(
      reservacionesService.confirm(tenantA, reservationB.id),
    ).rejects.toBeInstanceOf(NotFoundException);

    const state = (await dataSource.query(
      `SELECT current_schema() AS "schema", current_setting('search_path') AS "searchPath"`,
    )) as Array<{ schema: string; searchPath: string }>;
    expect(state[0]?.schema).toBe('public');
    expect(state[0]?.searchPath).not.toContain('tenant_');
  });
});
