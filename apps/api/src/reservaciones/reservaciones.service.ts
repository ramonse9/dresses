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
import type { CreateReservacionDto } from './dto/create-reservacion.dto.js';
import type { ReservacionResponseDto } from './dto/reservacion-response.dto.js';
import { ReservacionVestido } from './entities/reservacion-vestido.tenant-entity.js';
import {
  Reservacion,
  ReservacionEstado,
} from './entities/reservacion.tenant-entity.js';

const maximumMoneyMinorUnits = 999_999_999_999n;

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
        createdAt: reservacion.createdAt,
        updatedAt: reservacion.updatedAt,
      };
    });
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
    input: CreateReservacionDto,
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
    input: CreateReservacionDto,
  ): Promise<void> {
    const conflict = await manager
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
      })
      .limit(1)
      .getOne();

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
}
