import { randomUUID } from 'node:crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
} from '../src/audit/audit.constants.js';
import { AuditService } from '../src/audit/audit.service.js';
import { AuditEvent } from '../src/audit/entities/audit-event.entity.js';
import { Cliente } from '../src/clientes/entities/cliente.tenant-entity.js';
import { ClientesService } from '../src/clientes/clientes.service.js';
import { Empresa } from '../src/empresas/entities/empresa.entity.js';
import { EmpresasService } from '../src/empresas/empresas.service.js';
import { quoteTenantSchemaName } from '../src/empresas/tenant-schema-name.js';
import {
  MovimientoFinancieroMetodoPago,
  MovimientoFinancieroTipo,
} from '../src/reservaciones/entities/movimiento-financiero.tenant-entity.js';
import { CobroConcepto } from '../src/reservaciones/dto/create-cobro.dto.js';
import { ReservacionEstado } from '../src/reservaciones/entities/reservacion.tenant-entity.js';
import { ReservacionesService } from '../src/reservaciones/reservaciones.service.js';
import { Sucursal } from '../src/sucursales/entities/sucursal.tenant-entity.js';
import { SucursalesService } from '../src/sucursales/sucursales.service.js';
import { TenantResolverService } from '../src/tenancy/tenant-resolver.service.js';
import type { TenantScope } from '../src/tenancy/tenant-scope.js';
import { Usuario } from '../src/usuarios/entities/usuario.entity.js';
import {
  Vestido,
  VestidoEstadoOperativo,
} from '../src/vestidos/entities/vestido.tenant-entity.js';
import { VestidosService } from '../src/vestidos/vestidos.service.js';

describe('PostgreSQL reservation financial queries', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let empresasService: EmpresasService;
  let clientesService: ClientesService;
  let sucursalesService: SucursalesService;
  let vestidosService: VestidosService;
  let reservacionesService: ReservacionesService;
  let auditService: AuditService;
  let tenantResolver: TenantResolverService;
  let tenantA: TenantScope;
  let tenantB: TenantScope;
  let actor: Usuario;
  let sequence = 0;

  const suffix = `${process.pid}-${Date.now()}`;
  const slugs = [`finanzas-a-${suffix}`, `finanzas-b-${suffix}`];

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
    auditService = moduleRef.get(AuditService);
    tenantResolver = moduleRef.get(TenantResolverService);

    const empresaA = await empresasService.create({
      nombre: 'Finanzas A',
      slug: slugs[0],
    });
    const empresaB = await empresasService.create({
      nombre: 'Finanzas B',
      slug: slugs[1],
    });
    tenantA = await tenantResolver.resolveByEmpresaId(empresaA.id);
    tenantB = await tenantResolver.resolveByEmpresaId(empresaB.id);
    actor = await dataSource.getRepository(Usuario).save(
      dataSource.getRepository(Usuario).create({
        email: `finanzas-${suffix}@example.test`,
        passwordHash: 'test-only-password-hash',
        nombre: 'Operador financiero',
        activo: true,
      }),
    );
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      for (const slug of slugs) {
        const empresa = await dataSource
          .getRepository(Empresa)
          .findOne({ where: { slug } });

        if (empresa) {
          await dataSource.query(
            `DROP SCHEMA IF EXISTS ${quoteTenantSchemaName(empresa.schemaName)} CASCADE`,
          );
          await dataSource.getRepository(Empresa).delete({ id: empresa.id });
        }
      }

      if (actor) {
        await dataSource.getRepository(Usuario).delete({ id: actor.id });
      }
    }

    await moduleRef?.close();
  });

  async function createReservation(
    tenant: TenantScope,
    price = '2500.00',
    deposit = '1000.00',
  ) {
    sequence += 1;
    const cliente: Cliente = await clientesService.create(tenant, {
      nombre: `Cliente finanzas ${sequence}`,
      email: `cliente-finanzas-${sequence}-${suffix}@example.test`,
    });
    const sucursal: Sucursal = await sucursalesService.create(tenant, {
      nombre: `Sucursal finanzas ${sequence}`,
    });
    const vestido: Vestido = await vestidosService.create(tenant, {
      sucursalId: sucursal.id,
      codigo: `FIN-${sequence}`,
      nombre: `Vestido finanzas ${sequence}`,
      talla: 'M',
      color: 'Azul',
      precioRenta: price,
      deposito: deposit,
      estadoOperativo: VestidoEstadoOperativo.DISPONIBLE,
    });
    const reservacion = await reservacionesService.create(tenant, {
      clienteId: cliente.id,
      sucursalId: sucursal.id,
      vestidoIds: [vestido.id],
      fechaInicio: new Date('2027-06-10T16:00:00.000Z'),
      fechaFin: new Date('2027-06-12T16:00:00.000Z'),
      confirmar: false,
    });

    return { reservacion, sucursal };
  }

  async function insertMovement(
    tenant: TenantScope,
    values: {
      reservacionId: string;
      sucursalId: string;
      tipo: MovimientoFinancieroTipo;
      monto: string;
      metodoPago?: MovimientoFinancieroMetodoPago;
      movimientoOrigenId?: string;
      registradoPorUsuarioId?: string;
      createdAt: Date;
      referencia?: string;
    },
  ): Promise<string> {
    const rows = (await dataSource.query(
      `INSERT INTO ${quoteTenantSchemaName(tenant.schemaName)}."movimientos_financieros" ("reservacion_id", "sucursal_id", "tipo", "monto", "metodo_pago", "referencia", "movimiento_origen_id", "idempotency_key", "registrado_por_usuario_id", "created_at") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING "id"`,
      [
        values.reservacionId,
        values.sucursalId,
        values.tipo,
        values.monto,
        values.metodoPago ?? MovimientoFinancieroMetodoPago.EFECTIVO,
        values.referencia ?? null,
        values.movimientoOrigenId ?? null,
        randomUUID(),
        values.registradoPorUsuarioId ?? actor.id,
        values.createdAt,
      ],
    )) as Array<{ id: string }>;

    return rows[0]?.id ?? '';
  }

  async function setReservationState(
    tenant: TenantScope,
    id: string,
    estado: ReservacionEstado,
  ): Promise<void> {
    await dataSource.query(
      `UPDATE ${quoteTenantSchemaName(tenant.schemaName)}."reservaciones" SET "estado" = $1 WHERE "id" = $2`,
      [estado, id],
    );
  }

  it('returns zero balances and 404 for a reservation from another tenant', async () => {
    const reservationA = await createReservation(tenantA);
    const reservationB = await createReservation(tenantB);

    await expect(
      reservacionesService.findFinances(tenantA, reservationA.reservacion.id),
    ).resolves.toEqual({
      importeRenta: '2500.00',
      rentaCobrada: '0.00',
      rentaReembolsada: '0.00',
      rentaPagadaNeta: '0.00',
      saldoRenta: '2500.00',
      depositoRequerido: '1000.00',
      depositoRecibido: '0.00',
      depositoDevuelto: '0.00',
      depositoRetenido: '0.00',
      depositoPendienteCobro: '1000.00',
      depositoPorDevolver: '0.00',
    });
    await expect(
      reservacionesService.findFinances(tenantA, reservationB.reservacion.id),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      reservacionesService.findFinancialMovements(
        tenantA,
        reservationB.reservacion.id,
        { page: 1, limit: 20 },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('calculates partial payments, refunds, deposits, returns and reversals exactly', async () => {
    const { reservacion, sucursal } = await createReservation(tenantA);
    const at = (day: number) =>
      new Date(`2027-07-${String(day).padStart(2, '0')}T12:00:00.000Z`);
    await insertMovement(tenantA, {
      reservacionId: reservacion.id,
      sucursalId: sucursal.id,
      tipo: MovimientoFinancieroTipo.PAGO_RENTA,
      monto: '1499.70',
      createdAt: at(1),
    });
    await insertMovement(tenantA, {
      reservacionId: reservacion.id,
      sucursalId: sucursal.id,
      tipo: MovimientoFinancieroTipo.PAGO_RENTA,
      monto: '0.10',
      createdAt: at(2),
    });
    const rentPayment = await insertMovement(tenantA, {
      reservacionId: reservacion.id,
      sucursalId: sucursal.id,
      tipo: MovimientoFinancieroTipo.PAGO_RENTA,
      monto: '0.20',
      metodoPago: MovimientoFinancieroMetodoPago.TARJETA,
      referencia: 'TERMINAL-ABC',
      createdAt: at(3),
    });
    const refund = await insertMovement(tenantA, {
      reservacionId: reservacion.id,
      sucursalId: sucursal.id,
      tipo: MovimientoFinancieroTipo.REEMBOLSO_RENTA,
      monto: '200.00',
      movimientoOrigenId: rentPayment,
      createdAt: at(4),
    });
    await insertMovement(tenantA, {
      reservacionId: reservacion.id,
      sucursalId: sucursal.id,
      tipo: MovimientoFinancieroTipo.REVERSO,
      monto: '50.00',
      movimientoOrigenId: refund,
      createdAt: at(5),
    });
    const deposit = await insertMovement(tenantA, {
      reservacionId: reservacion.id,
      sucursalId: sucursal.id,
      tipo: MovimientoFinancieroTipo.PAGO_DEPOSITO,
      monto: '1000.00',
      createdAt: at(6),
    });
    const depositReturn = await insertMovement(tenantA, {
      reservacionId: reservacion.id,
      sucursalId: sucursal.id,
      tipo: MovimientoFinancieroTipo.DEVOLUCION_DEPOSITO,
      monto: '300.00',
      movimientoOrigenId: deposit,
      createdAt: at(7),
    });
    await insertMovement(tenantA, {
      reservacionId: reservacion.id,
      sucursalId: sucursal.id,
      tipo: MovimientoFinancieroTipo.REVERSO,
      monto: '100.00',
      movimientoOrigenId: depositReturn,
      createdAt: at(8),
    });

    const result = await reservacionesService.findFinances(
      tenantA,
      reservacion.id,
    );

    expect(result).toEqual({
      importeRenta: '2500.00',
      rentaCobrada: '1500.00',
      rentaReembolsada: '150.00',
      rentaPagadaNeta: '1350.00',
      saldoRenta: '1150.00',
      depositoRequerido: '1000.00',
      depositoRecibido: '1000.00',
      depositoDevuelto: '200.00',
      depositoRetenido: '800.00',
      depositoPendienteCobro: '200.00',
      depositoPorDevolver: '800.00',
    });
    expect(JSON.stringify(result)).not.toContain('schemaName');
    expect(JSON.stringify(result)).not.toContain('tenant_');
  });

  it('paginates, filters and resolves available and historical actors', async () => {
    const { reservacion, sucursal } = await createReservation(tenantA);
    const payment = await insertMovement(tenantA, {
      reservacionId: reservacion.id,
      sucursalId: sucursal.id,
      tipo: MovimientoFinancieroTipo.PAGO_RENTA,
      monto: '500.00',
      metodoPago: MovimientoFinancieroMetodoPago.TARJETA,
      referencia: 'PAGO-1',
      createdAt: new Date('2027-08-10T12:00:00.000Z'),
    });
    await insertMovement(tenantA, {
      reservacionId: reservacion.id,
      sucursalId: sucursal.id,
      tipo: MovimientoFinancieroTipo.REEMBOLSO_RENTA,
      monto: '100.00',
      movimientoOrigenId: payment,
      registradoPorUsuarioId: randomUUID(),
      createdAt: new Date('2027-08-11T12:00:00.000Z'),
    });
    await insertMovement(tenantA, {
      reservacionId: reservacion.id,
      sucursalId: sucursal.id,
      tipo: MovimientoFinancieroTipo.PAGO_DEPOSITO,
      monto: '1000.00',
      createdAt: new Date('2027-09-01T12:00:00.000Z'),
    });

    const firstPage = await reservacionesService.findFinancialMovements(
      tenantA,
      reservacion.id,
      { page: 1, limit: 2 },
    );
    expect(firstPage.pagination).toEqual({
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
    });
    expect(firstPage.data[1]).toMatchObject({
      tipo: MovimientoFinancieroTipo.REEMBOLSO_RENTA,
      movimientoOrigen: {
        id: payment,
        tipo: MovimientoFinancieroTipo.PAGO_RENTA,
        monto: '500.00',
      },
      actor: {
        nombre: 'Actor histórico desconocido',
        email: null,
        activo: null,
      },
    });

    const filtered = await reservacionesService.findFinancialMovements(
      tenantA,
      reservacion.id,
      {
        page: 1,
        limit: 20,
        tipo: MovimientoFinancieroTipo.PAGO_RENTA,
        metodoPago: MovimientoFinancieroMetodoPago.TARJETA,
        fechaDesde: new Date('2027-08-10T12:00:00.000Z'),
        fechaHasta: new Date('2027-08-11T12:00:00.000Z'),
      },
    );
    expect(filtered.data).toEqual([
      expect.objectContaining({
        id: payment,
        monto: '500.00',
        referencia: 'PAGO-1',
        actor: {
          id: actor.id,
          nombre: actor.nombre,
          email: actor.email,
          activo: true,
        },
      }),
    ]);
    expect(filtered.pagination.total).toBe(1);
    expect(JSON.stringify(filtered)).not.toContain('schemaName');
  });

  it('records partial and exact rent and deposit payments with actor and audit', async () => {
    const { reservacion } = await createReservation(tenantA);
    const sessionId = randomUUID();
    const rentKey = randomUUID();
    const firstRent = await reservacionesService.recordCharge(
      tenantA,
      reservacion.id,
      {
        concepto: CobroConcepto.RENTA,
        monto: '500.00',
        metodoPago: MovimientoFinancieroMetodoPago.EFECTIVO,
        referencia: 'CAJA-01',
        notas: 'Primer abono',
        idempotencyKey: rentKey,
      },
      { actorUsuarioId: actor.id, sessionId },
    );
    expect(firstRent).toMatchObject({
      movimiento: {
        tipo: MovimientoFinancieroTipo.PAGO_RENTA,
        monto: '500.00',
        actor: { id: actor.id, nombre: actor.nombre },
      },
      finanzas: {
        rentaCobrada: '500.00',
        rentaPagadaNeta: '500.00',
        saldoRenta: '2000.00',
      },
    });

    const exactRent = await reservacionesService.recordCharge(
      tenantA,
      reservacion.id,
      {
        concepto: CobroConcepto.RENTA,
        monto: '2000.00',
        metodoPago: MovimientoFinancieroMetodoPago.TRANSFERENCIA,
        referencia: null,
        notas: null,
        idempotencyKey: randomUUID(),
      },
      { actorUsuarioId: actor.id, sessionId },
    );
    expect(exactRent.finanzas.saldoRenta).toBe('0.00');

    const deposit = await reservacionesService.recordCharge(
      tenantA,
      reservacion.id,
      {
        concepto: CobroConcepto.DEPOSITO,
        monto: '1000.00',
        metodoPago: MovimientoFinancieroMetodoPago.TARJETA,
        referencia: null,
        notas: null,
        idempotencyKey: randomUUID(),
      },
      { actorUsuarioId: actor.id, sessionId },
    );
    expect(deposit).toMatchObject({
      movimiento: {
        tipo: MovimientoFinancieroTipo.PAGO_DEPOSITO,
        monto: '1000.00',
      },
      finanzas: {
        depositoRecibido: '1000.00',
        depositoRetenido: '1000.00',
        depositoPendienteCobro: '0.00',
      },
    });

    const persisted = (await dataSource.query(
      `SELECT "sucursal_id" AS "sucursalId", "registrado_por_usuario_id" AS "actorId" FROM ${quoteTenantSchemaName(tenantA.schemaName)}."movimientos_financieros" WHERE "id" = $1`,
      [firstRent.movimiento.id],
    )) as Array<{ sucursalId: string; actorId: string }>;
    expect(persisted).toEqual([
      { sucursalId: reservacion.sucursal.id, actorId: actor.id },
    ]);

    const audit = await dataSource.getRepository(AuditEvent).findOne({
      where: {
        action: AUDIT_ACTIONS.FINANCIAL_PAYMENT_RECORDED,
        resourceId: firstRent.movimiento.id,
      },
    });
    expect(audit).toMatchObject({
      empresaId: tenantA.empresaId,
      actorUsuarioId: actor.id,
      sessionId,
      resourceType: AUDIT_RESOURCE_TYPES.FINANCIAL_MOVEMENT,
      metadata: {
        reservacionId: reservacion.id,
        concepto: CobroConcepto.RENTA,
        monto: '500.00',
        metodoPago: MovimientoFinancieroMetodoPago.EFECTIVO,
      },
    });
    expect(JSON.stringify(audit?.metadata)).not.toContain('CAJA-01');
    expect(JSON.stringify(audit?.metadata)).not.toContain('Primer abono');
    expect(JSON.stringify(firstRent)).not.toContain('schemaName');
  });

  it.each([
    ReservacionEstado.BORRADOR,
    ReservacionEstado.CONFIRMADA,
    ReservacionEstado.ENTREGADA,
  ])('allows a payment while the reservation is %s', async (estado) => {
    const { reservacion } = await createReservation(tenantA, '100.00', '0.00');
    await setReservationState(tenantA, reservacion.id, estado);

    await expect(
      reservacionesService.recordCharge(
        tenantA,
        reservacion.id,
        {
          concepto: CobroConcepto.RENTA,
          monto: '100.00',
          metodoPago: MovimientoFinancieroMetodoPago.EFECTIVO,
          referencia: null,
          notas: null,
          idempotencyKey: randomUUID(),
        },
        { actorUsuarioId: actor.id, sessionId: randomUUID() },
      ),
    ).resolves.toMatchObject({ finanzas: { saldoRenta: '0.00' } });
  });

  it.each([ReservacionEstado.DEVUELTA, ReservacionEstado.CANCELADA])(
    'rejects payments while the reservation is %s',
    async (estado) => {
      const { reservacion } = await createReservation(tenantA);
      await setReservationState(tenantA, reservacion.id, estado);

      await expect(
        reservacionesService.recordCharge(
          tenantA,
          reservacion.id,
          {
            concepto: CobroConcepto.RENTA,
            monto: '1.00',
            metodoPago: MovimientoFinancieroMetodoPago.EFECTIVO,
            referencia: null,
            notas: null,
            idempotencyKey: randomUUID(),
          },
          { actorUsuarioId: actor.id, sessionId: randomUUID() },
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    },
  );

  it('rejects rent and deposit overpayments', async () => {
    const { reservacion } = await createReservation(tenantA);
    const actorContext = {
      actorUsuarioId: actor.id,
      sessionId: randomUUID(),
    };

    await expect(
      reservacionesService.recordCharge(
        tenantA,
        reservacion.id,
        {
          concepto: CobroConcepto.RENTA,
          monto: '2500.01',
          metodoPago: MovimientoFinancieroMetodoPago.EFECTIVO,
          referencia: null,
          notas: null,
          idempotencyKey: randomUUID(),
        },
        actorContext,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      reservacionesService.recordCharge(
        tenantA,
        reservacion.id,
        {
          concepto: CobroConcepto.DEPOSITO,
          monto: '1000.01',
          metodoPago: MovimientoFinancieroMetodoPago.EFECTIVO,
          referencia: null,
          notas: null,
          idempotencyKey: randomUUID(),
        },
        actorContext,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns an existing movement for the same idempotent payload and rejects a different payload', async () => {
    const { reservacion } = await createReservation(tenantA);
    const idempotencyKey = randomUUID();
    const input = {
      concepto: CobroConcepto.RENTA,
      monto: '500.00',
      metodoPago: MovimientoFinancieroMetodoPago.EFECTIVO,
      referencia: null,
      notas: null,
      idempotencyKey,
    };
    const actorContext = {
      actorUsuarioId: actor.id,
      sessionId: randomUUID(),
    };
    const first = await reservacionesService.recordCharge(
      tenantA,
      reservacion.id,
      input,
      actorContext,
    );
    const repeated = await reservacionesService.recordCharge(
      tenantA,
      reservacion.id,
      input,
      actorContext,
    );
    expect(repeated.movimiento.id).toBe(first.movimiento.id);

    const count = (await dataSource.query(
      `SELECT COUNT(*)::integer AS "count" FROM ${quoteTenantSchemaName(tenantA.schemaName)}."movimientos_financieros" WHERE "idempotency_key" = $1`,
      [idempotencyKey],
    )) as Array<{ count: number }>;
    expect(count).toEqual([{ count: 1 }]);
    await expect(
      reservacionesService.recordCharge(
        tenantA,
        reservacion.id,
        { ...input, monto: '501.00' },
        actorContext,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('serializes concurrent payments so they cannot exceed the balance or duplicate a key', async () => {
    const { reservacion } = await createReservation(tenantA, '1000.00', '0.00');
    const actorContext = {
      actorUsuarioId: actor.id,
      sessionId: randomUUID(),
    };
    const differentKeys = await Promise.allSettled(
      [randomUUID(), randomUUID()].map((idempotencyKey) =>
        reservacionesService.recordCharge(
          tenantA,
          reservacion.id,
          {
            concepto: CobroConcepto.RENTA,
            monto: '700.00',
            metodoPago: MovimientoFinancieroMetodoPago.EFECTIVO,
            referencia: null,
            notas: null,
            idempotencyKey,
          },
          actorContext,
        ),
      ),
    );
    expect(
      differentKeys.filter(({ status }) => status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      differentKeys.filter(({ status }) => status === 'rejected'),
    ).toHaveLength(1);

    const sameKey = randomUUID();
    const samePayload = {
      concepto: CobroConcepto.RENTA,
      monto: '300.00',
      metodoPago: MovimientoFinancieroMetodoPago.EFECTIVO,
      referencia: null,
      notas: null,
      idempotencyKey: sameKey,
    };
    const duplicates = await Promise.all([
      reservacionesService.recordCharge(
        tenantA,
        reservacion.id,
        samePayload,
        actorContext,
      ),
      reservacionesService.recordCharge(
        tenantA,
        reservacion.id,
        samePayload,
        actorContext,
      ),
    ]);
    expect(duplicates[0].movimiento.id).toBe(duplicates[1].movimiento.id);
  });

  it('rolls back the movement when audit fails and returns 404 across tenants', async () => {
    const reservationA = await createReservation(tenantA);
    const reservationB = await createReservation(tenantB);
    const rollbackKey = randomUUID();
    const record = vi
      .spyOn(auditService, 'record')
      .mockRejectedValueOnce(new Error('controlled audit failure'));

    await expect(
      reservacionesService.recordCharge(
        tenantA,
        reservationA.reservacion.id,
        {
          concepto: CobroConcepto.RENTA,
          monto: '100.00',
          metodoPago: MovimientoFinancieroMetodoPago.EFECTIVO,
          referencia: null,
          notas: null,
          idempotencyKey: rollbackKey,
        },
        { actorUsuarioId: actor.id, sessionId: randomUUID() },
      ),
    ).rejects.toThrow('controlled audit failure');
    record.mockRestore();

    const rolledBack = (await dataSource.query(
      `SELECT COUNT(*)::integer AS "count" FROM ${quoteTenantSchemaName(tenantA.schemaName)}."movimientos_financieros" WHERE "idempotency_key" = $1`,
      [rollbackKey],
    )) as Array<{ count: number }>;
    expect(rolledBack).toEqual([{ count: 0 }]);

    await expect(
      reservacionesService.recordCharge(
        tenantA,
        reservationB.reservacion.id,
        {
          concepto: CobroConcepto.RENTA,
          monto: '100.00',
          metodoPago: MovimientoFinancieroMetodoPago.EFECTIVO,
          referencia: null,
          notas: null,
          idempotencyKey: randomUUID(),
        },
        { actorUsuarioId: actor.id, sessionId: randomUUID() },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
