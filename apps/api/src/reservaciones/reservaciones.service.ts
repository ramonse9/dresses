import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Cliente } from '../clientes/entities/cliente.tenant-entity.js';
import { TenantContextService } from '../database/tenant-context.service.js';
import { Sucursal } from '../sucursales/entities/sucursal.tenant-entity.js';
import type { TenantScope } from '../tenancy/tenant-scope.js';
import {
  Vestido,
  VestidoEstadoOperativo,
} from '../vestidos/entities/vestido.tenant-entity.js';
import type { CancelReservacionDto } from './dto/cancel-reservacion.dto.js';
import type { CreateReservacionDto } from './dto/create-reservacion.dto.js';
import type { ListReservacionesQueryDto } from './dto/list-reservaciones-query.dto.js';
import type {
  PaginatedReservacionesResponseDto,
  ReservacionListItemDto,
  ReservacionResponseDto,
} from './dto/reservacion-response.dto.js';
import type { UpdateReservacionDto } from './dto/update-reservacion.dto.js';
import { ReservacionVestido } from './entities/reservacion-vestido.tenant-entity.js';
import {
  Reservacion,
  ReservacionEstado,
} from './entities/reservacion.tenant-entity.js';

const maximumMoneyMinorUnits = 999_999_999_999n;
type ReservationSelection = {
  sucursalId: string;
  vestidoIds: string[];
};
type ReservationRange = {
  vestidoIds: string[];
  fechaInicio: Date;
  fechaFin: Date;
};

@Injectable()
export class ReservacionesService {
  constructor(private readonly tenantContext: TenantContextService) {}

  create(
    tenant: TenantScope,
    input: CreateReservacionDto,
  ): Promise<ReservacionResponseDto> {
    return this.tenantContext.run(tenant, async (manager) => {
      const cliente = await this.requireActiveCliente(manager, input.clienteId);
      const sucursal = await this.requireActiveSucursal(
        manager,
        input.sucursalId,
      );
      const lockOrder = [...input.vestidoIds].sort();

      if (input.confirmar) {
        await this.ensureNoBlockingOverlap(manager, input);
        await this.acquireDressLocks(manager, tenant, lockOrder);
      }

      const vestidos = await this.requireAvailableCatalogDresses(
        manager,
        input,
        lockOrder,
      );

      if (input.confirmar) {
        await this.ensureNoBlockingOverlap(manager, input);
      }

      const vestidosById = new Map(
        vestidos.map((vestido) => [vestido.id, vestido]),
      );
      const orderedVestidos = input.vestidoIds.map((id) => {
        const vestido = vestidosById.get(id);

        if (!vestido) {
          throw new NotFoundException('Vestido no encontrado');
        }

        return vestido;
      });
      const importeRenta = this.sumMoney(
        orderedVestidos.map((vestido) => vestido.precioRenta),
      );
      const depositoRequerido = this.sumMoney(
        orderedVestidos.map((vestido) => vestido.deposito ?? '0.00'),
      );
      const confirmedAt = input.confirmar ? new Date() : null;
      const reservacionRepository = manager.getRepository(Reservacion);
      const reservacion = await reservacionRepository.save(
        reservacionRepository.create({
          clienteId: cliente.id,
          sucursalId: sucursal.id,
          fechaInicio: input.fechaInicio,
          fechaFin: input.fechaFin,
          estado: input.confirmar
            ? ReservacionEstado.CONFIRMADA
            : ReservacionEstado.BORRADOR,
          notas: input.notas ?? null,
          importeRenta,
          depositoRequerido,
          confirmadaAt: confirmedAt,
          entregadaAt: null,
          devueltaAt: null,
          canceladaAt: null,
          motivoCancelacion: null,
        }),
      );
      const detailRepository = manager.getRepository(ReservacionVestido);

      await detailRepository.save(
        orderedVestidos.map((vestido) =>
          detailRepository.create({
            reservacionId: reservacion.id,
            vestidoId: vestido.id,
            precioRenta: vestido.precioRenta,
            deposito: vestido.deposito ?? '0.00',
          }),
        ),
      );

      return {
        id: reservacion.id,
        cliente: {
          id: cliente.id,
          nombre: cliente.nombre,
          telefono: cliente.telefono,
          email: cliente.email,
        },
        sucursal: { id: sucursal.id, nombre: sucursal.nombre },
        vestidos: orderedVestidos.map((vestido) => ({
          id: vestido.id,
          codigo: vestido.codigo,
          nombre: vestido.nombre,
          talla: vestido.talla,
          color: vestido.color,
          precioRenta: vestido.precioRenta,
          deposito: vestido.deposito ?? '0.00',
        })),
        fechaInicio: reservacion.fechaInicio,
        fechaFin: reservacion.fechaFin,
        estado: reservacion.estado,
        notas: reservacion.notas,
        importeRenta: reservacion.importeRenta,
        depositoRequerido: reservacion.depositoRequerido,
        confirmadaAt: reservacion.confirmadaAt,
        entregadaAt: reservacion.entregadaAt,
        devueltaAt: reservacion.devueltaAt,
        canceladaAt: reservacion.canceladaAt,
        motivoCancelacion: reservacion.motivoCancelacion,
        createdAt: reservacion.createdAt,
        updatedAt: reservacion.updatedAt,
      };
    });
  }

  findAll(
    tenant: TenantScope,
    input: ListReservacionesQueryDto,
  ): Promise<PaginatedReservacionesResponseDto> {
    return this.tenantContext.run(tenant, async (manager) => {
      const query = manager
        .getRepository(Reservacion)
        .createQueryBuilder('reservacion')
        .innerJoinAndSelect('reservacion.cliente', 'cliente')
        .innerJoinAndSelect('reservacion.sucursal', 'sucursal')
        .select([
          'reservacion.id',
          'reservacion.fechaInicio',
          'reservacion.fechaFin',
          'reservacion.estado',
          'reservacion.notas',
          'reservacion.importeRenta',
          'reservacion.depositoRequerido',
          'reservacion.createdAt',
          'reservacion.updatedAt',
          'cliente.id',
          'cliente.nombre',
          'cliente.telefono',
          'cliente.email',
          'sucursal.id',
          'sucursal.nombre',
        ]);

      if (input.clienteId !== undefined) {
        query.andWhere('reservacion.clienteId = :clienteId', {
          clienteId: input.clienteId,
        });
      }
      if (input.sucursalId !== undefined) {
        query.andWhere('reservacion.sucursalId = :sucursalId', {
          sucursalId: input.sucursalId,
        });
      }
      if (input.estado !== undefined) {
        query.andWhere('reservacion.estado = :estado', {
          estado: input.estado,
        });
      }
      if (input.fechaDesde !== undefined) {
        query.andWhere('reservacion.fechaFin > :fechaDesde', {
          fechaDesde: input.fechaDesde,
        });
      }
      if (input.fechaHasta !== undefined) {
        query.andWhere('reservacion.fechaInicio < :fechaHasta', {
          fechaHasta: input.fechaHasta,
        });
      }
      if (input.q !== undefined) {
        query.andWhere(
          `(cliente.nombre ILIKE :search ESCAPE '\\' OR cliente.email ILIKE :search ESCAPE '\\' OR cliente.telefono ILIKE :search ESCAPE '\\')`,
          { search: `%${this.escapeLikePattern(input.q)}%` },
        );
      }

      const total = await query.getCount();
      const { entities, raw } = await query
        .addSelect(
          `(SELECT COUNT(*)::integer FROM "reservacion_vestidos" "detalle_count" WHERE "detalle_count"."reservacion_id" = "reservacion"."id")`,
          'vestidosCount',
        )
        .orderBy('reservacion.createdAt', 'DESC')
        .addOrderBy('reservacion.id', 'DESC')
        .skip((input.page - 1) * input.limit)
        .take(input.limit)
        .getRawAndEntities();

      return {
        data: entities.map((reservacion, index) =>
          this.toListResponse(
            reservacion,
            Number((raw[index] as { vestidosCount?: unknown }).vestidosCount),
          ),
        ),
        pagination: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(total / input.limit),
        },
      };
    });
  }

  findOne(tenant: TenantScope, id: string): Promise<ReservacionResponseDto> {
    return this.tenantContext.run(tenant, async (manager) => {
      const reservacion = await this.loadReservationDetail(manager, id);

      if (!reservacion) {
        throw new NotFoundException('Reservación no encontrada');
      }

      return this.toDetailResponse(reservacion);
    });
  }

  update(
    tenant: TenantScope,
    id: string,
    input: UpdateReservacionDto,
  ): Promise<ReservacionResponseDto> {
    return this.tenantContext.run(tenant, async (manager) => {
      const repository = manager.getRepository(Reservacion);
      const reservacion = await repository
        .createQueryBuilder('reservacion')
        .where('reservacion.id = :id', { id })
        .setLock('pessimistic_write')
        .getOne();

      if (!reservacion) {
        throw new NotFoundException('Reservación no encontrada');
      }
      if (
        reservacion.estado !== ReservacionEstado.BORRADOR &&
        reservacion.estado !== ReservacionEstado.CONFIRMADA
      ) {
        throw new ConflictException(
          'La reservación no puede editarse en su estado actual',
        );
      }

      const detailRepository = manager.getRepository(ReservacionVestido);
      const existingDetails = await detailRepository
        .createQueryBuilder('detalle')
        .innerJoinAndSelect('detalle.vestido', 'vestido')
        .where('detalle.reservacionId = :id', { id })
        .orderBy('detalle.createdAt', 'ASC')
        .addOrderBy('detalle.id', 'ASC')
        .getMany();
      const finalClienteId = input.clienteId ?? reservacion.clienteId;
      const finalSucursalId = input.sucursalId ?? reservacion.sucursalId;
      const finalVestidoIds =
        input.vestidoIds ?? existingDetails.map((detail) => detail.vestidoId);
      const finalFechaInicio = input.fechaInicio ?? reservacion.fechaInicio;
      const finalFechaFin = input.fechaFin ?? reservacion.fechaFin;

      if (finalFechaFin.getTime() <= finalFechaInicio.getTime()) {
        throw new BadRequestException(
          'fechaFin debe ser posterior a fechaInicio',
        );
      }

      const structuralChange =
        input.clienteId !== undefined ||
        input.sucursalId !== undefined ||
        input.vestidoIds !== undefined ||
        input.fechaInicio !== undefined ||
        input.fechaFin !== undefined;

      if (structuralChange) {
        await this.requireActiveCliente(manager, finalClienteId);
        await this.requireActiveSucursal(manager, finalSucursalId);

        if (reservacion.estado === ReservacionEstado.CONFIRMADA) {
          const lockOrder = [
            ...new Set([
              ...existingDetails.map((detail) => detail.vestidoId),
              ...finalVestidoIds,
            ]),
          ].sort();
          await this.acquireDressLocks(manager, tenant, lockOrder);
        }

        const catalogDresses = await this.requireAvailableCatalogDresses(
          manager,
          { sucursalId: finalSucursalId, vestidoIds: finalVestidoIds },
          [...finalVestidoIds].sort(),
        );

        if (reservacion.estado === ReservacionEstado.CONFIRMADA) {
          await this.ensureNoBlockingOverlap(
            manager,
            {
              vestidoIds: finalVestidoIds,
              fechaInicio: finalFechaInicio,
              fechaFin: finalFechaFin,
            },
            reservacion.id,
          );
        }

        const existingByVestidoId = new Map(
          existingDetails.map((detail) => [detail.vestidoId, detail]),
        );
        const catalogById = new Map(
          catalogDresses.map((vestido) => [vestido.id, vestido]),
        );
        const finalSnapshots = finalVestidoIds.map((vestidoId) => {
          const existing = existingByVestidoId.get(vestidoId);
          const catalog = catalogById.get(vestidoId);

          if (!catalog) {
            throw new NotFoundException('Vestido no encontrado');
          }

          return {
            vestidoId,
            precioRenta: existing?.precioRenta ?? catalog.precioRenta,
            deposito: existing?.deposito ?? catalog.deposito ?? '0.00',
          };
        });

        reservacion.clienteId = finalClienteId;
        reservacion.sucursalId = finalSucursalId;
        reservacion.fechaInicio = finalFechaInicio;
        reservacion.fechaFin = finalFechaFin;
        reservacion.importeRenta = this.sumMoney(
          finalSnapshots.map((snapshot) => snapshot.precioRenta),
        );
        reservacion.depositoRequerido = this.sumMoney(
          finalSnapshots.map((snapshot) => snapshot.deposito),
        );

        if (input.vestidoIds !== undefined) {
          await detailRepository.delete({ reservacionId: reservacion.id });
          await detailRepository.save(
            finalSnapshots.map((snapshot) =>
              detailRepository.create({
                reservacionId: reservacion.id,
                ...snapshot,
              }),
            ),
          );
        }
      }

      if (input.notas !== undefined) {
        reservacion.notas = input.notas;
      }

      await repository.save(reservacion);
      const updated = await this.loadReservationDetail(manager, reservacion.id);

      if (!updated) {
        throw new NotFoundException('Reservación no encontrada');
      }

      return this.toDetailResponse(updated);
    });
  }

  confirm(tenant: TenantScope, id: string): Promise<ReservacionResponseDto> {
    return this.tenantContext.run(tenant, async (manager) => {
      const reservacion = await this.requireLockedReservation(manager, id);
      this.requireState(reservacion, ReservacionEstado.BORRADOR);

      const vestidoIds = await this.loadReservationDressIds(manager, id);
      const lockOrder = [...vestidoIds].sort();

      await this.acquireDressLocks(manager, tenant, lockOrder);
      await this.requireActiveCliente(manager, reservacion.clienteId);
      await this.requireActiveSucursal(manager, reservacion.sucursalId);
      await this.requireAvailableCatalogDresses(
        manager,
        { sucursalId: reservacion.sucursalId, vestidoIds },
        lockOrder,
      );
      await this.ensureNoBlockingOverlap(
        manager,
        {
          vestidoIds,
          fechaInicio: reservacion.fechaInicio,
          fechaFin: reservacion.fechaFin,
        },
        reservacion.id,
      );

      reservacion.estado = ReservacionEstado.CONFIRMADA;
      reservacion.confirmadaAt = new Date();
      await manager.getRepository(Reservacion).save(reservacion);

      return this.requireReservationDetail(manager, reservacion.id);
    });
  }

  deliver(tenant: TenantScope, id: string): Promise<ReservacionResponseDto> {
    return this.tenantContext.run(tenant, async (manager) => {
      const reservacion = await this.requireLockedReservation(manager, id);
      this.requireState(reservacion, ReservacionEstado.CONFIRMADA);

      const vestidoIds = await this.loadReservationDressIds(manager, id);
      await this.requireAvailableCatalogDresses(
        manager,
        { sucursalId: reservacion.sucursalId, vestidoIds },
        [...vestidoIds].sort(),
      );

      reservacion.estado = ReservacionEstado.ENTREGADA;
      reservacion.entregadaAt = new Date();
      await manager.getRepository(Reservacion).save(reservacion);

      return this.requireReservationDetail(manager, reservacion.id);
    });
  }

  returnReservation(
    tenant: TenantScope,
    id: string,
  ): Promise<ReservacionResponseDto> {
    return this.tenantContext.run(tenant, async (manager) => {
      const reservacion = await this.requireLockedReservation(manager, id);
      this.requireState(reservacion, ReservacionEstado.ENTREGADA);

      reservacion.estado = ReservacionEstado.DEVUELTA;
      reservacion.devueltaAt = new Date();
      await manager.getRepository(Reservacion).save(reservacion);

      return this.requireReservationDetail(manager, reservacion.id);
    });
  }

  cancel(
    tenant: TenantScope,
    id: string,
    input: CancelReservacionDto,
  ): Promise<ReservacionResponseDto> {
    return this.tenantContext.run(tenant, async (manager) => {
      const reservacion = await this.requireLockedReservation(manager, id);

      if (
        reservacion.estado !== ReservacionEstado.BORRADOR &&
        reservacion.estado !== ReservacionEstado.CONFIRMADA
      ) {
        throw new ConflictException('Transición de estado no permitida');
      }

      reservacion.estado = ReservacionEstado.CANCELADA;
      reservacion.canceladaAt = new Date();
      reservacion.motivoCancelacion = input.motivo;
      await manager.getRepository(Reservacion).save(reservacion);

      return this.requireReservationDetail(manager, reservacion.id);
    });
  }

  private async requireLockedReservation(
    manager: EntityManager,
    id: string,
  ): Promise<Reservacion> {
    const reservacion = await manager
      .getRepository(Reservacion)
      .createQueryBuilder('reservacion')
      .where('reservacion.id = :id', { id })
      .setLock('pessimistic_write')
      .getOne();

    if (!reservacion) {
      throw new NotFoundException('Reservación no encontrada');
    }

    return reservacion;
  }

  private requireState(
    reservacion: Reservacion,
    expected: ReservacionEstado,
  ): void {
    if (reservacion.estado !== expected) {
      throw new ConflictException('Transición de estado no permitida');
    }
  }

  private async loadReservationDressIds(
    manager: EntityManager,
    reservacionId: string,
  ): Promise<string[]> {
    const details = await manager.getRepository(ReservacionVestido).find({
      select: { vestidoId: true },
      where: { reservacionId },
      order: { vestidoId: 'ASC' },
    });

    if (details.length === 0) {
      throw new ConflictException('La reservación no contiene vestidos');
    }

    return details.map(({ vestidoId }) => vestidoId);
  }

  private async requireReservationDetail(
    manager: EntityManager,
    id: string,
  ): Promise<ReservacionResponseDto> {
    const reservacion = await this.loadReservationDetail(manager, id);

    if (!reservacion) {
      throw new NotFoundException('Reservación no encontrada');
    }

    return this.toDetailResponse(reservacion);
  }

  private async requireActiveCliente(
    manager: EntityManager,
    clienteId: string,
  ): Promise<Cliente> {
    const cliente = await manager
      .getRepository(Cliente)
      .createQueryBuilder('cliente')
      .where('cliente.id = :clienteId', { clienteId })
      .andWhere('cliente.activo = true')
      .setLock('pessimistic_read')
      .getOne();

    if (!cliente) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return cliente;
  }

  private async requireActiveSucursal(
    manager: EntityManager,
    sucursalId: string,
  ): Promise<Sucursal> {
    const sucursal = await manager
      .getRepository(Sucursal)
      .createQueryBuilder('sucursal')
      .where('sucursal.id = :sucursalId', { sucursalId })
      .andWhere('sucursal.activo = true')
      .setLock('pessimistic_read')
      .getOne();

    if (!sucursal) {
      throw new NotFoundException('Sucursal no encontrada');
    }

    return sucursal;
  }

  private async acquireDressLocks(
    manager: EntityManager,
    tenant: TenantScope,
    vestidoIds: string[],
  ): Promise<void> {
    for (const vestidoId of vestidoIds) {
      await manager.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [`reservacion:${tenant.empresaId}:${vestidoId}`],
      );
    }
  }

  private async requireAvailableCatalogDresses(
    manager: EntityManager,
    input: ReservationSelection,
    vestidoIds: string[],
  ): Promise<Vestido[]> {
    const vestidos = await manager
      .getRepository(Vestido)
      .createQueryBuilder('vestido')
      .where('vestido.id IN (:...vestidoIds)', { vestidoIds })
      .orderBy('vestido.id', 'ASC')
      .setLock('pessimistic_read')
      .getMany();

    if (vestidos.length !== vestidoIds.length) {
      throw new NotFoundException('Vestido no encontrado');
    }
    if (vestidos.some((vestido) => !vestido.activo)) {
      throw new BadRequestException(
        'Uno o más vestidos no están disponibles para reservar',
      );
    }
    if (
      vestidos.some(
        (vestido) =>
          vestido.estadoOperativo !== VestidoEstadoOperativo.DISPONIBLE,
      )
    ) {
      throw new BadRequestException(
        'Uno o más vestidos no están disponibles para reservar',
      );
    }
    if (vestidos.some((vestido) => vestido.sucursalId !== input.sucursalId)) {
      throw new BadRequestException(
        'Uno o más vestidos no pertenecen a la sucursal seleccionada',
      );
    }

    return vestidos;
  }

  private async ensureNoBlockingOverlap(
    manager: EntityManager,
    input: ReservationRange,
    excludedReservationId?: string,
  ): Promise<void> {
    const query = manager
      .getRepository(ReservacionVestido)
      .createQueryBuilder('detalle')
      .innerJoin('detalle.reservacion', 'reservacion')
      .where('detalle.vestidoId IN (:...vestidoIds)', {
        vestidoIds: input.vestidoIds,
      })
      .andWhere('reservacion.estado IN (:...blockingStates)', {
        blockingStates: [
          ReservacionEstado.CONFIRMADA,
          ReservacionEstado.ENTREGADA,
        ],
      })
      .andWhere('reservacion.fechaInicio < :fechaFin', {
        fechaFin: input.fechaFin,
      })
      .andWhere('reservacion.fechaFin > :fechaInicio', {
        fechaInicio: input.fechaInicio,
      });

    if (excludedReservationId !== undefined) {
      query.andWhere('reservacion.id != :excludedReservationId', {
        excludedReservationId,
      });
    }

    const conflict = await query.limit(1).getOne();

    if (conflict) {
      throw new ConflictException(
        'Uno o más vestidos no están disponibles en las fechas seleccionadas',
      );
    }
  }

  private sumMoney(values: string[]): string {
    const total = values.reduce(
      (sum, value) => sum + this.toMinorUnits(value),
      0n,
    );

    if (total > maximumMoneyMinorUnits) {
      throw new BadRequestException(
        'El importe total excede el máximo permitido',
      );
    }

    return `${total / 100n}.${String(total % 100n).padStart(2, '0')}`;
  }

  private toMinorUnits(value: string): bigint {
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);

    if (!match?.[1]) {
      throw new Error('Invalid persisted monetary value');
    }

    return BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
  }

  private async loadReservationDetail(
    manager: EntityManager,
    id: string,
  ): Promise<Reservacion | null> {
    return manager
      .getRepository(Reservacion)
      .createQueryBuilder('reservacion')
      .innerJoinAndSelect('reservacion.cliente', 'cliente')
      .innerJoinAndSelect('reservacion.sucursal', 'sucursal')
      .leftJoinAndSelect('reservacion.vestidos', 'detalle')
      .leftJoinAndSelect('detalle.vestido', 'vestido')
      .select([
        'reservacion.id',
        'reservacion.fechaInicio',
        'reservacion.fechaFin',
        'reservacion.estado',
        'reservacion.notas',
        'reservacion.importeRenta',
        'reservacion.depositoRequerido',
        'reservacion.confirmadaAt',
        'reservacion.entregadaAt',
        'reservacion.devueltaAt',
        'reservacion.canceladaAt',
        'reservacion.motivoCancelacion',
        'reservacion.createdAt',
        'reservacion.updatedAt',
        'cliente.id',
        'cliente.nombre',
        'cliente.telefono',
        'cliente.email',
        'sucursal.id',
        'sucursal.nombre',
        'detalle.id',
        'detalle.precioRenta',
        'detalle.deposito',
        'detalle.createdAt',
        'vestido.id',
        'vestido.codigo',
        'vestido.nombre',
        'vestido.talla',
        'vestido.color',
      ])
      .where('reservacion.id = :id', { id })
      .orderBy('detalle.createdAt', 'ASC')
      .addOrderBy('detalle.id', 'ASC')
      .getOne();
  }

  private toListResponse(
    reservacion: Reservacion,
    vestidosCount: number,
  ): ReservacionListItemDto {
    return {
      id: reservacion.id,
      cliente: {
        id: reservacion.cliente.id,
        nombre: reservacion.cliente.nombre,
        telefono: reservacion.cliente.telefono,
        email: reservacion.cliente.email,
      },
      sucursal: {
        id: reservacion.sucursal.id,
        nombre: reservacion.sucursal.nombre,
      },
      fechaInicio: reservacion.fechaInicio,
      fechaFin: reservacion.fechaFin,
      estado: reservacion.estado,
      notas: reservacion.notas,
      importeRenta: reservacion.importeRenta,
      depositoRequerido: reservacion.depositoRequerido,
      createdAt: reservacion.createdAt,
      updatedAt: reservacion.updatedAt,
      vestidosCount,
    };
  }

  private toDetailResponse(reservacion: Reservacion): ReservacionResponseDto {
    return {
      id: reservacion.id,
      cliente: {
        id: reservacion.cliente.id,
        nombre: reservacion.cliente.nombre,
        telefono: reservacion.cliente.telefono,
        email: reservacion.cliente.email,
      },
      sucursal: {
        id: reservacion.sucursal.id,
        nombre: reservacion.sucursal.nombre,
      },
      vestidos: reservacion.vestidos.map((detail) => ({
        id: detail.vestido.id,
        codigo: detail.vestido.codigo,
        nombre: detail.vestido.nombre,
        talla: detail.vestido.talla,
        color: detail.vestido.color,
        precioRenta: detail.precioRenta,
        deposito: detail.deposito,
      })),
      fechaInicio: reservacion.fechaInicio,
      fechaFin: reservacion.fechaFin,
      estado: reservacion.estado,
      notas: reservacion.notas,
      importeRenta: reservacion.importeRenta,
      depositoRequerido: reservacion.depositoRequerido,
      confirmadaAt: reservacion.confirmadaAt,
      entregadaAt: reservacion.entregadaAt,
      devueltaAt: reservacion.devueltaAt,
      canceladaAt: reservacion.canceladaAt,
      motivoCancelacion: reservacion.motivoCancelacion,
      createdAt: reservacion.createdAt,
      updatedAt: reservacion.updatedAt,
    };
  }

  private escapeLikePattern(value: string): string {
    return value
      .replaceAll('\\', '\\\\')
      .replaceAll('%', '\\%')
      .replaceAll('_', '\\_');
  }
}
