import { NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import type { AuditService } from '../audit/audit.service.js';
import { TenantContextService } from '../database/tenant-context.service.js';
import type { TenantScope } from '../tenancy/tenant-scope.js';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import {
  MovimientoFinanciero,
  MovimientoFinancieroMetodoPago,
  MovimientoFinancieroTipo,
} from './entities/movimiento-financiero.tenant-entity.js';
import { Reservacion } from './entities/reservacion.tenant-entity.js';
import { ReservacionesService } from './reservaciones.service.js';

const tenant = {
  empresaId: '019a6f33-82b7-4a22-971b-6a8d7c5e4f30',
  empresaSlug: 'atelier',
  schemaName: 'tenant_019a6f3382b74a22971b6a8d7c5e4f30',
} as TenantScope;
const reservationId = 'a18c2a56-d33f-4d88-a8e7-42931121e295';
const actorId = 'b18c2a56-d33f-4d88-a8e7-42931121e295';

function movement(
  id: string,
  tipo: MovimientoFinancieroTipo,
  monto: string,
  movimientoOrigenId: string | null = null,
): MovimientoFinanciero {
  return Object.assign(new MovimientoFinanciero(), {
    id,
    reservacionId: reservationId,
    sucursalId: 'c18c2a56-d33f-4d88-a8e7-42931121e295',
    tipo,
    monto,
    metodoPago: MovimientoFinancieroMetodoPago.EFECTIVO,
    referencia: null,
    notas: null,
    movimientoOrigenId,
    idempotencyKey: crypto.randomUUID(),
    registradoPorUsuarioId: actorId,
    createdAt: new Date('2027-01-10T12:00:00.000Z'),
  });
}

function summaryContext(movimientos: MovimientoFinanciero[]) {
  const reservationRepository = {
    findOne: vi.fn().mockResolvedValue(
      Object.assign(new Reservacion(), {
        id: reservationId,
        importeRenta: '2500.00',
        depositoRequerido: '1000.00',
      }),
    ),
  };
  const movementRepository = {
    find: vi.fn().mockResolvedValue(movimientos),
  };
  const manager = {
    getRepository: vi.fn((entity: unknown) =>
      entity === Reservacion ? reservationRepository : movementRepository,
    ),
  } as unknown as EntityManager;
  const run = vi.fn(
    async (
      _tenant: TenantScope,
      operation: (value: EntityManager) => unknown,
    ) => operation(manager),
  );

  return {
    service: new ReservacionesService(
      { run } as unknown as TenantContextService,
      { record: vi.fn() } as unknown as AuditService,
    ),
    run,
    reservationRepository,
    movementRepository,
  };
}

describe('ReservacionesService financial queries', () => {
  it('returns exact zeroed balances when there are no movements', async () => {
    const context = summaryContext([]);

    await expect(
      context.service.findFinances(tenant, reservationId),
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
    expect(context.run).toHaveBeenCalledWith(tenant, expect.any(Function));
  });

  it('applies payments, refunds, deposits, returns and reversal chains exactly', async () => {
    const rentPayment = movement(
      '11111111-1111-4111-8111-111111111111',
      MovimientoFinancieroTipo.PAGO_RENTA,
      '1500.10',
    );
    const refund = movement(
      '22222222-2222-4222-8222-222222222222',
      MovimientoFinancieroTipo.REEMBOLSO_RENTA,
      '200.05',
      rentPayment.id,
    );
    const reversedRefund = movement(
      '33333333-3333-4333-8333-333333333333',
      MovimientoFinancieroTipo.REVERSO,
      '50.02',
      refund.id,
    );
    const restoredRefund = movement(
      '44444444-4444-4444-8444-444444444444',
      MovimientoFinancieroTipo.REVERSO,
      '10.01',
      reversedRefund.id,
    );
    const deposit = movement(
      '55555555-5555-4555-8555-555555555555',
      MovimientoFinancieroTipo.PAGO_DEPOSITO,
      '1000.00',
    );
    const depositReturn = movement(
      '66666666-6666-4666-8666-666666666666',
      MovimientoFinancieroTipo.DEVOLUCION_DEPOSITO,
      '300.00',
      deposit.id,
    );
    const context = summaryContext([
      rentPayment,
      refund,
      reversedRefund,
      restoredRefund,
      deposit,
      depositReturn,
    ]);

    await expect(
      context.service.findFinances(tenant, reservationId),
    ).resolves.toEqual({
      importeRenta: '2500.00',
      rentaCobrada: '1500.10',
      rentaReembolsada: '160.04',
      rentaPagadaNeta: '1340.06',
      saldoRenta: '1159.94',
      depositoRequerido: '1000.00',
      depositoRecibido: '1000.00',
      depositoDevuelto: '300.00',
      depositoRetenido: '700.00',
      depositoPendienteCobro: '300.00',
      depositoPorDevolver: '700.00',
    });
  });

  it('returns 404 without querying movements for an unavailable reservation', async () => {
    const context = summaryContext([]);
    context.reservationRepository.findOne.mockResolvedValue(null);

    await expect(
      context.service.findFinances(tenant, reservationId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(context.movementRepository.find).not.toHaveBeenCalled();
  });

  it('paginates and resolves all actors in one grouped lookup', async () => {
    const origin = movement(
      '11111111-1111-4111-8111-111111111111',
      MovimientoFinancieroTipo.PAGO_RENTA,
      '100.00',
    );
    const reversal = movement(
      '22222222-2222-4222-8222-222222222222',
      MovimientoFinancieroTipo.REVERSO,
      '100.00',
      origin.id,
    );
    reversal.movimientoOrigen = origin;
    const unknownActorMovement = movement(
      '33333333-3333-4333-8333-333333333333',
      MovimientoFinancieroTipo.PAGO_DEPOSITO,
      '50.00',
    );
    unknownActorMovement.registradoPorUsuarioId =
      'd18c2a56-d33f-4d88-a8e7-42931121e295';
    const builder = {
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      addOrderBy: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      getCount: vi.fn().mockResolvedValue(2),
      getMany: vi.fn().mockResolvedValue([reversal, unknownActorMovement]),
    };
    const reservationRepository = {
      findOne: vi.fn().mockResolvedValue({ id: reservationId }),
    };
    const movementRepository = { createQueryBuilder: () => builder };
    const actorRepository = {
      find: vi.fn().mockResolvedValue([
        Object.assign(new Usuario(), {
          id: actorId,
          nombre: 'Operador',
          email: 'operador@example.test',
          activo: true,
        }),
      ]),
    };
    const manager = {
      getRepository: vi.fn((entity: unknown) => {
        if (entity === Reservacion) return reservationRepository;
        if (entity === MovimientoFinanciero) return movementRepository;
        return actorRepository;
      }),
    } as unknown as EntityManager;
    const run = vi.fn(
      async (
        _tenant: TenantScope,
        operation: (value: EntityManager) => unknown,
      ) => operation(manager),
    );
    const service = new ReservacionesService(
      { run } as unknown as TenantContextService,
      { record: vi.fn() } as unknown as AuditService,
    );

    const result = await service.findFinancialMovements(tenant, reservationId, {
      page: 1,
      limit: 20,
      tipo: MovimientoFinancieroTipo.REVERSO,
      metodoPago: MovimientoFinancieroMetodoPago.EFECTIVO,
      fechaDesde: new Date('2027-01-01T00:00:00.000Z'),
      fechaHasta: new Date('2027-02-01T00:00:00.000Z'),
    });

    expect(builder.andWhere).toHaveBeenCalledTimes(4);
    expect(actorRepository.find).toHaveBeenCalledTimes(1);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
    });
    expect(result.data).toEqual([
      expect.objectContaining({
        id: reversal.id,
        movimientoOrigen: {
          id: origin.id,
          tipo: origin.tipo,
          monto: origin.monto,
        },
        actor: expect.objectContaining({ nombre: 'Operador' }),
      }),
      expect.objectContaining({
        id: unknownActorMovement.id,
        actor: {
          id: unknownActorMovement.registradoPorUsuarioId,
          nombre: 'Actor histórico desconocido',
          email: null,
          activo: null,
        },
      }),
    ]);
    expect(JSON.stringify(result)).not.toContain('schemaName');
  });
});
