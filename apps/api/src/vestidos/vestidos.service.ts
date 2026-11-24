import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EntityManager,
  ILike,
  Not,
  QueryFailedError,
  Repository,
} from 'typeorm';
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
} from '../audit/audit.constants.js';
import {
  AuditService,
  type AuthenticatedAuditActor,
} from '../audit/audit.service.js';
import { TenantContextService } from '../database/tenant-context.service.js';
import { ReservacionEstado } from '../reservaciones/entities/reservacion.tenant-entity.js';
import { Sucursal } from '../sucursales/entities/sucursal.tenant-entity.js';
import type { TenantScope } from '../tenancy/tenant-scope.js';
import type { CreateVestidoDto } from './dto/create-vestido.dto.js';
import type { DisponibilidadVestidosQueryDto } from './dto/disponibilidad-vestidos-query.dto.js';
import type { ListVestidosQueryDto } from './dto/list-vestidos-query.dto.js';
import type {
  DisponibilidadVestidosResponseDto,
  PaginatedVestidosResponseDto,
  VestidoResponseDto,
} from './dto/vestido-response.dto.js';
import type { UpdateVestidoDto } from './dto/update-vestido.dto.js';
import { Vestido } from './entities/vestido.tenant-entity.js';

@Injectable()
export class VestidosService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    tenant: TenantScope,
    input: CreateVestidoDto,
    actor?: AuthenticatedAuditActor,
  ): Promise<Vestido> {
    try {
      return await this.tenantContext.run(tenant, async (manager) => {
        await this.requireActiveSucursal(manager, input.sucursalId);
        const repository = manager.getRepository(Vestido);
        await this.ensureUniqueCode(repository, input.codigo);

        const saved = await repository.save(
          repository.create({
            sucursalId: input.sucursalId,
            codigo: input.codigo,
            nombre: input.nombre,
            descripcion: input.descripcion ?? null,
            talla: input.talla,
            color: input.color,
            marca: input.marca ?? null,
            precioRenta: input.precioRenta,
            deposito: input.deposito ?? null,
            estadoOperativo: input.estadoOperativo,
            activo: true,
          }),
        );
        await this.auditService.record(
          {
            empresaId: tenant.empresaId,
            actorUsuarioId: actor?.actorUsuarioId ?? null,
            sessionId: actor?.sessionId ?? null,
            action: AUDIT_ACTIONS.DRESS_CREATED,
            resourceType: AUDIT_RESOURCE_TYPES.DRESS,
            resourceId: saved.id,
            metadata: {
              initialActive: true,
              initialOperationalStatus: saved.estadoOperativo,
            },
            safeMetadataFields: ['initialActive', 'initialOperationalStatus'],
          },
          manager,
        );
        return saved;
      });
    } catch (error) {
      this.rethrowCodeConflict(error);
    }
  }

  findAll(
    tenant: TenantScope,
    input: ListVestidosQueryDto,
  ): Promise<PaginatedVestidosResponseDto> {
    return this.tenantContext.run(tenant, async (manager) => {
      const query = manager
        .getRepository(Vestido)
        .createQueryBuilder('vestido')
        .innerJoinAndSelect('vestido.sucursal', 'sucursal');

      if (input.sucursalId !== undefined) {
        query.andWhere('vestido.sucursalId = :sucursalId', {
          sucursalId: input.sucursalId,
        });
      }
      if (input.activo !== undefined) {
        query.andWhere('vestido.activo = :activo', { activo: input.activo });
      }
      if (input.estadoOperativo !== undefined) {
        query.andWhere('vestido.estadoOperativo = :estadoOperativo', {
          estadoOperativo: input.estadoOperativo,
        });
      }
      if (input.q !== undefined) {
        query.andWhere(
          `(vestido.codigo ILIKE :search ESCAPE '\\' OR vestido.nombre ILIKE :search ESCAPE '\\' OR vestido.marca ILIKE :search ESCAPE '\\')`,
          { search: `%${this.escapeLikePattern(input.q)}%` },
        );
      }

      const [vestidos, total] = await query
        .orderBy('vestido.createdAt', 'DESC')
        .addOrderBy('vestido.id', 'DESC')
        .skip((input.page - 1) * input.limit)
        .take(input.limit)
        .getManyAndCount();

      return {
        data: vestidos.map((vestido) => this.toResponse(vestido)),
        pagination: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(total / input.limit),
        },
      };
    });
  }

  findOne(tenant: TenantScope, id: string): Promise<VestidoResponseDto> {
    return this.tenantContext.run(tenant, async (manager) => {
      const vestido = await manager
        .getRepository(Vestido)
        .createQueryBuilder('vestido')
        .innerJoinAndSelect('vestido.sucursal', 'sucursal')
        .where('vestido.id = :id', { id })
        .getOne();

      if (!vestido) {
        throw new NotFoundException('Vestido no encontrado');
      }

      return this.toResponse(vestido);
    });
  }

  findAvailability(
    tenant: TenantScope,
    input: DisponibilidadVestidosQueryDto,
  ): Promise<DisponibilidadVestidosResponseDto> {
    return this.tenantContext.run(tenant, async (manager) => {
      const sucursal = await manager.getRepository(Sucursal).findOne({
        where: { id: input.sucursalId, activo: true },
      });

      if (!sucursal) {
        throw new NotFoundException('Sucursal no encontrada');
      }

      const query = manager
        .getRepository(Vestido)
        .createQueryBuilder('vestido')
        .innerJoinAndSelect('vestido.sucursal', 'sucursal')
        .select([
          'vestido.id',
          'vestido.sucursalId',
          'vestido.codigo',
          'vestido.nombre',
          'vestido.descripcion',
          'vestido.talla',
          'vestido.color',
          'vestido.marca',
          'vestido.precioRenta',
          'vestido.deposito',
          'vestido.estadoOperativo',
          'vestido.activo',
          'vestido.createdAt',
          'vestido.updatedAt',
          'sucursal.id',
          'sucursal.nombre',
          'sucursal.activo',
        ])
        .where('vestido.sucursalId = :sucursalId', {
          sucursalId: input.sucursalId,
        })
        .andWhere('vestido.activo = true')
        .andWhere('vestido.estadoOperativo = :estadoOperativo', {
          estadoOperativo: input.estadoOperativo,
        })
        .andWhere(
          `NOT EXISTS (
            SELECT 1
            FROM "reservacion_vestidos" "detalle"
            INNER JOIN "reservaciones" "reservacion"
              ON "reservacion"."id" = "detalle"."reservacion_id"
            WHERE "detalle"."vestido_id" = "vestido"."id"
              AND "reservacion"."estado" IN (:...blockingStates)
              AND "reservacion"."fecha_inicio" < :fechaFin
              AND "reservacion"."fecha_fin" > :fechaInicio
          )`,
          {
            blockingStates: [
              ReservacionEstado.CONFIRMADA,
              ReservacionEstado.ENTREGADA,
            ],
            fechaInicio: input.fechaInicio,
            fechaFin: input.fechaFin,
          },
        );

      if (input.talla !== undefined) {
        query.andWhere('LOWER(vestido.talla) = LOWER(:talla)', {
          talla: input.talla,
        });
      }
      if (input.color !== undefined) {
        query.andWhere('LOWER(vestido.color) = LOWER(:color)', {
          color: input.color,
        });
      }

      const [vestidos, total] = await query
        .orderBy('vestido.createdAt', 'DESC')
        .addOrderBy('vestido.id', 'DESC')
        .skip((input.page - 1) * input.limit)
        .take(input.limit)
        .getManyAndCount();

      return {
        data: vestidos.map((vestido) => this.toResponse(vestido)),
        pagination: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(total / input.limit),
        },
        range: {
          fechaInicio: input.fechaInicio,
          fechaFin: input.fechaFin,
        },
      };
    });
  }

  async update(
    tenant: TenantScope,
    id: string,
    input: UpdateVestidoDto,
    actor?: AuthenticatedAuditActor,
  ): Promise<Vestido> {
    try {
      return await this.tenantContext.run(tenant, async (manager) => {
        const repository = manager.getRepository(Vestido);
        const vestido = await this.requireVestido(repository, id);
        const changedFields: string[] = [];
        const changes: Record<string, unknown> = {};
        const previousSucursalId = vestido.sucursalId;
        const previousOperationalStatus = vestido.estadoOperativo;
        const previousActive = vestido.activo;

        if (
          input.sucursalId !== undefined &&
          input.sucursalId !== vestido.sucursalId
        ) {
          await this.requireActiveSucursal(manager, input.sucursalId);
          vestido.sucursalId = input.sucursalId;
        }
        if (input.codigo !== undefined && input.codigo !== vestido.codigo) {
          await this.ensureUniqueCode(repository, input.codigo, id);
          changedFields.push('codigo');
          changes.codigo = { previous: vestido.codigo, new: input.codigo };
          vestido.codigo = input.codigo;
        }
        if (input.nombre !== undefined && input.nombre !== vestido.nombre) {
          changedFields.push('nombre');
          changes.nombre = { previous: vestido.nombre, new: input.nombre };
          vestido.nombre = input.nombre;
        }
        if (
          input.descripcion !== undefined &&
          input.descripcion !== vestido.descripcion
        ) {
          changedFields.push('descripcion');
          vestido.descripcion = input.descripcion;
        }
        if (input.talla !== undefined && input.talla !== vestido.talla) {
          changedFields.push('talla');
          changes.talla = { previous: vestido.talla, new: input.talla };
          vestido.talla = input.talla;
        }
        if (input.color !== undefined && input.color !== vestido.color) {
          changedFields.push('color');
          changes.color = { previous: vestido.color, new: input.color };
          vestido.color = input.color;
        }
        if (input.marca !== undefined && input.marca !== vestido.marca) {
          changedFields.push('marca');
          changes.marca = { previous: vestido.marca, new: input.marca };
          vestido.marca = input.marca;
        }
        if (
          input.precioRenta !== undefined &&
          input.precioRenta !== vestido.precioRenta
        ) {
          changedFields.push('precioRenta');
          changes.precioRenta = {
            previous: vestido.precioRenta,
            new: input.precioRenta,
          };
          vestido.precioRenta = input.precioRenta;
        }
        if (
          input.deposito !== undefined &&
          input.deposito !== vestido.deposito
        ) {
          changedFields.push('deposito');
          changes.deposito = {
            previous: vestido.deposito,
            new: input.deposito,
          };
          vestido.deposito = input.deposito;
        }
        if (
          input.estadoOperativo !== undefined &&
          input.estadoOperativo !== vestido.estadoOperativo
        ) {
          vestido.estadoOperativo = input.estadoOperativo;
        }
        if (input.activo !== undefined && input.activo !== vestido.activo) {
          vestido.activo = input.activo;
        }

        const transferred = vestido.sucursalId !== previousSucursalId;
        const operationalStatusChanged =
          vestido.estadoOperativo !== previousOperationalStatus;
        const activeChanged = vestido.activo !== previousActive;
        if (
          changedFields.length === 0 &&
          !transferred &&
          !operationalStatusChanged &&
          !activeChanged
        ) {
          return vestido;
        }

        const saved = await repository.save(vestido);
        if (changedFields.length > 0) {
          await this.auditService.record(
            {
              empresaId: tenant.empresaId,
              actorUsuarioId: actor?.actorUsuarioId ?? null,
              sessionId: actor?.sessionId ?? null,
              action: AUDIT_ACTIONS.DRESS_UPDATED,
              resourceType: AUDIT_RESOURCE_TYPES.DRESS,
              resourceId: saved.id,
              metadata: { changedFields, changes },
              safeMetadataFields: ['changedFields', 'changes'],
            },
            manager,
          );
        }
        if (transferred) {
          await this.auditService.record(
            {
              empresaId: tenant.empresaId,
              actorUsuarioId: actor?.actorUsuarioId ?? null,
              sessionId: actor?.sessionId ?? null,
              action: AUDIT_ACTIONS.DRESS_TRANSFERRED,
              resourceType: AUDIT_RESOURCE_TYPES.DRESS,
              resourceId: saved.id,
              metadata: {
                previousSucursalId,
                newSucursalId: saved.sucursalId,
              },
              safeMetadataFields: ['previousSucursalId', 'newSucursalId'],
            },
            manager,
          );
        }
        if (operationalStatusChanged) {
          await this.auditService.record(
            {
              empresaId: tenant.empresaId,
              actorUsuarioId: actor?.actorUsuarioId ?? null,
              sessionId: actor?.sessionId ?? null,
              action: AUDIT_ACTIONS.DRESS_OPERATIONAL_STATUS_CHANGED,
              resourceType: AUDIT_RESOURCE_TYPES.DRESS,
              resourceId: saved.id,
              metadata: {
                previousOperationalStatus,
                newOperationalStatus: saved.estadoOperativo,
              },
              safeMetadataFields: [
                'previousOperationalStatus',
                'newOperationalStatus',
              ],
            },
            manager,
          );
        }
        if (activeChanged) {
          await this.recordActiveChange(
            manager,
            tenant,
            saved.id,
            previousActive,
            saved.activo,
            actor,
          );
        }
        return saved;
      });
    } catch (error) {
      this.rethrowCodeConflict(error);
    }
  }

  deactivate(
    tenant: TenantScope,
    id: string,
    actor?: AuthenticatedAuditActor,
  ): Promise<Vestido> {
    return this.tenantContext.run(tenant, async (manager) => {
      const repository = manager.getRepository(Vestido);
      const vestido = await this.requireVestido(repository, id);
      if (!vestido.activo) {
        return vestido;
      }
      vestido.activo = false;
      const saved = await repository.save(vestido);
      await this.recordActiveChange(
        manager,
        tenant,
        saved.id,
        true,
        false,
        actor,
      );
      return saved;
    });
  }

  private recordActiveChange(
    manager: EntityManager,
    tenant: TenantScope,
    resourceId: string,
    previousActive: boolean,
    newActive: boolean,
    actor?: AuthenticatedAuditActor,
  ): Promise<unknown> {
    return this.auditService.record(
      {
        empresaId: tenant.empresaId,
        actorUsuarioId: actor?.actorUsuarioId ?? null,
        sessionId: actor?.sessionId ?? null,
        action: newActive
          ? AUDIT_ACTIONS.DRESS_ACTIVATED
          : AUDIT_ACTIONS.DRESS_DEACTIVATED,
        resourceType: AUDIT_RESOURCE_TYPES.DRESS,
        resourceId,
        metadata: { previousActive, newActive },
        safeMetadataFields: ['previousActive', 'newActive'],
      },
      manager,
    );
  }

  private async requireActiveSucursal(
    manager: EntityManager,
    sucursalId: string,
  ): Promise<void> {
    const sucursal = await manager.getRepository(Sucursal).findOne({
      where: { id: sucursalId, activo: true },
    });

    if (!sucursal) {
      throw new NotFoundException('Sucursal no encontrada');
    }
  }

  private async ensureUniqueCode(
    repository: Repository<Vestido>,
    codigo: string,
    excludedId?: string,
  ): Promise<void> {
    const duplicate = await repository.findOne({
      where: {
        codigo: ILike(codigo),
        ...(excludedId ? { id: Not(excludedId) } : {}),
      },
    });

    if (duplicate) {
      throw new ConflictException(
        'Ya existe un vestido con ese código en la empresa',
      );
    }
  }

  private async requireVestido(
    repository: Repository<Vestido>,
    id: string,
  ): Promise<Vestido> {
    const vestido = await repository.findOne({ where: { id } });

    if (!vestido) {
      throw new NotFoundException('Vestido no encontrado');
    }

    return vestido;
  }

  private rethrowCodeConflict(error: unknown): never {
    if (error instanceof ConflictException) {
      throw error;
    }

    if (error instanceof QueryFailedError) {
      const driverError = error.driverError as {
        code?: string;
        constraint?: string;
      };

      if (
        driverError.code === '23505' &&
        driverError.constraint === 'UQ_vestidos_codigo_normalized'
      ) {
        throw new ConflictException(
          'Ya existe un vestido con ese código en la empresa',
        );
      }
    }

    throw error;
  }

  private escapeLikePattern(value: string): string {
    return value
      .replaceAll('\\', '\\\\')
      .replaceAll('%', '\\%')
      .replaceAll('_', '\\_');
  }

  private toResponse(vestido: Vestido): VestidoResponseDto {
    return {
      id: vestido.id,
      sucursalId: vestido.sucursalId,
      codigo: vestido.codigo,
      nombre: vestido.nombre,
      descripcion: vestido.descripcion,
      talla: vestido.talla,
      color: vestido.color,
      marca: vestido.marca,
      precioRenta: vestido.precioRenta,
      deposito: vestido.deposito,
      estadoOperativo: vestido.estadoOperativo,
      activo: vestido.activo,
      createdAt: vestido.createdAt,
      updatedAt: vestido.updatedAt,
      sucursal: {
        id: vestido.sucursal.id,
        nombre: vestido.sucursal.nombre,
        activo: vestido.sucursal.activo,
      },
    };
  }
}
