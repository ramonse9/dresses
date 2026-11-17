import { ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Cliente } from '../clientes/entities/cliente.tenant-entity.js';
import { TenantContextService } from '../database/tenant-context.service.js';
import { Sucursal } from '../sucursales/entities/sucursal.tenant-entity.js';
import type { TenantScope } from '../tenancy/tenant-scope.js';
import {
  Vestido,
  VestidoEstadoOperativo,
} from '../vestidos/entities/vestido.tenant-entity.js';
import type { CreateReservacionDto } from './dto/create-reservacion.dto.js';
import { ReservacionVestido } from './entities/reservacion-vestido.tenant-entity.js';
import {
  Reservacion,
  ReservacionEstado,
} from './entities/reservacion.tenant-entity.js';
import { ReservacionesService } from './reservaciones.service.js';

const clienteId = 'a18c2a56-d33f-4d88-a8e7-42931121e295';
const sucursalId = 'b18c2a56-d33f-4d88-a8e7-42931121e295';
const vestidoAId = 'c18c2a56-d33f-4d88-a8e7-42931121e295';
const vestidoBId = 'd18c2a56-d33f-4d88-a8e7-42931121e295';
const tenant = {
  empresaId: '019a6f33-82b7-4a22-971b-6a8d7c5e4f30',
  empresaSlug: 'atelier',
  schemaName: 'tenant_019a6f3382b74a22971b6a8d7c5e4f30',
} as TenantScope;
const baseInput: CreateReservacionDto = {
  clienteId,
  sucursalId,
  vestidoIds: [vestidoBId, vestidoAId],
  fechaInicio: new Date('2026-12-10T23:00:00.000Z'),
  fechaFin: new Date('2026-12-12T23:00:00.000Z'),
  notas: null,
  confirmar: true,
};

function queryBuilder<T>(result: { one?: T | null; many?: T[] }) {
  return {
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    setLock: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    getOne: vi.fn().mockResolvedValue(result.one ?? null),
    getMany: vi.fn().mockResolvedValue(result.many ?? []),
  };
}

function createContext(conflict = false) {
  const cliente = Object.assign(new Cliente(), {
    id: clienteId,
    nombre: 'Ana',
    telefono: null,
    email: 'ana@example.com',
    activo: true,
  });
  const sucursal = Object.assign(new Sucursal(), {
    id: sucursalId,
    nombre: 'Centro',
    activo: true,
  });
  const vestidos = [
    Object.assign(new Vestido(), {
      id: vestidoAId,
      sucursalId,
      codigo: 'V-001',
      nombre: 'Azul',
      talla: 'M',
      color: 'Azul',
      precioRenta: '0.10',
      deposito: null,
      activo: true,
      estadoOperativo: VestidoEstadoOperativo.DISPONIBLE,
    }),
    Object.assign(new Vestido(), {
      id: vestidoBId,
      sucursalId,
      codigo: 'V-002',
      nombre: 'Rojo',
      talla: 'G',
      color: 'Rojo',
      precioRenta: '0.20',
      deposito: '0.10',
      activo: true,
      estadoOperativo: VestidoEstadoOperativo.DISPONIBLE,
    }),
  ];
  const clienteBuilder = queryBuilder({ one: cliente });
  const sucursalBuilder = queryBuilder({ one: sucursal });
  const vestidosBuilder = queryBuilder({ many: vestidos });
  const conflictBuilder = queryBuilder({
    one: conflict ? Object.assign(new ReservacionVestido(), { id: 'x' }) : null,
  });
  const reservationCreate = vi.fn((value: Partial<Reservacion>) =>
    Object.assign(new Reservacion(), value),
  );
  const reservationSave = vi.fn(async (value: Reservacion) =>
    Object.assign(value, {
      id: 'reservation-id',
      createdAt: new Date('2026-11-17T20:00:00.000Z'),
      updatedAt: new Date('2026-11-17T20:00:00.000Z'),
    }),
  );
  const detailCreate = vi.fn((value: Partial<ReservacionVestido>) =>
    Object.assign(new ReservacionVestido(), value),
  );
  const detailSave = vi.fn(async (values: ReservacionVestido[]) => values);
  const repositories = new Map<unknown, unknown>([
    [Cliente, { createQueryBuilder: () => clienteBuilder }],
    [Sucursal, { createQueryBuilder: () => sucursalBuilder }],
    [Vestido, { createQueryBuilder: () => vestidosBuilder }],
    [Reservacion, { create: reservationCreate, save: reservationSave }],
    [
      ReservacionVestido,
      {
        createQueryBuilder: () => conflictBuilder,
        create: detailCreate,
        save: detailSave,
      },
    ],
  ]);
  const managerQuery = vi
    .fn()
    .mockResolvedValue([{ pg_advisory_xact_lock: null }]);
  const manager = {
    getRepository: vi.fn((entity: unknown) => repositories.get(entity)),
    query: managerQuery,
  } as unknown as EntityManager;
  const run = vi.fn(
    async (_scope: TenantScope, operation: (value: EntityManager) => unknown) =>
      operation(manager),
  );

  return {
    service: new ReservacionesService({
      run,
    } as unknown as TenantContextService),
    run,
    managerQuery,
    conflictBuilder,
    reservationSave,
    detailSave,
  };
}

describe('ReservacionesService', () => {
  it('creates a confirmed reservation atomically with ordered locks and exact snapshots', async () => {
    const context = createContext();

    const result = await context.service.create(tenant, baseInput);

    expect(context.run).toHaveBeenCalledTimes(1);
    expect(context.managerQuery).toHaveBeenNthCalledWith(
      1,
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [`reservacion:${tenant.empresaId}:${vestidoAId}`],
    );
    expect(context.managerQuery).toHaveBeenNthCalledWith(
      2,
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [`reservacion:${tenant.empresaId}:${vestidoBId}`],
    );
    expect(context.reservationSave).toHaveBeenCalledWith(
      expect.objectContaining({
        estado: ReservacionEstado.CONFIRMADA,
        importeRenta: '0.30',
        depositoRequerido: '0.10',
        confirmadaAt: expect.any(Date),
      }),
    );
    expect(context.detailSave).toHaveBeenCalledWith([
      expect.objectContaining({
        vestidoId: vestidoBId,
        precioRenta: '0.20',
        deposito: '0.10',
      }),
      expect.objectContaining({
        vestidoId: vestidoAId,
        precioRenta: '0.10',
        deposito: '0.00',
      }),
    ]);
    expect(result).toMatchObject({
      estado: ReservacionEstado.CONFIRMADA,
      importeRenta: '0.30',
      depositoRequerido: '0.10',
    });
    expect(JSON.stringify(result)).not.toContain('schemaName');
    expect(JSON.stringify(result)).not.toContain('tenant_');
    expect(context.conflictBuilder.getOne).toHaveBeenCalledTimes(2);
  });

  it('allows drafts without locks or conflict checks', async () => {
    const context = createContext();

    await expect(
      context.service.create(tenant, { ...baseInput, confirmar: false }),
    ).resolves.toMatchObject({
      estado: ReservacionEstado.BORRADOR,
      confirmadaAt: null,
    });
    expect(context.managerQuery).not.toHaveBeenCalled();
    expect(context.conflictBuilder.getOne).not.toHaveBeenCalled();
  });

  it('rejects blocking overlaps before persisting anything', async () => {
    const context = createContext(true);

    await expect(
      context.service.create(tenant, baseInput),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(context.reservationSave).not.toHaveBeenCalled();
    expect(context.detailSave).not.toHaveBeenCalled();
  });
});
