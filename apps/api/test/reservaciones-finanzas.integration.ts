import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { Cliente } from '../src/clientes/entities/cliente.tenant-entity.js';
import { ClientesService } from '../src/clientes/clientes.service.js';
import { Empresa } from '../src/empresas/entities/empresa.entity.js';
import { EmpresasService } from '../src/empresas/empresas.service.js';
import { quoteTenantSchemaName } from '../src/empresas/tenant-schema-name.js';
import {
  MovimientoFinancieroMetodoPago,
  MovimientoFinancieroTipo,
} from '../src/reservaciones/entities/movimiento-financiero.tenant-entity.js';
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
      depositoPendienteCobro: '0.00',
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
});
