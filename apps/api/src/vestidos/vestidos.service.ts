import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, ILike, QueryFailedError, Repository } from 'typeorm';
import { TenantContextService } from '../database/tenant-context.service.js';
import { Sucursal } from '../sucursales/entities/sucursal.tenant-entity.js';
import type { TenantScope } from '../tenancy/tenant-scope.js';
import type { CreateVestidoDto } from './dto/create-vestido.dto.js';
import type { ListVestidosQueryDto } from './dto/list-vestidos-query.dto.js';
import type {
  PaginatedVestidosResponseDto,
  VestidoResponseDto,
} from './dto/vestido-response.dto.js';
import { Vestido } from './entities/vestido.tenant-entity.js';

@Injectable()
export class VestidosService {
  constructor(private readonly tenantContext: TenantContextService) {}

  async create(tenant: TenantScope, input: CreateVestidoDto): Promise<Vestido> {
    try {
      return await this.tenantContext.run(tenant, async (manager) => {
        await this.requireActiveSucursal(manager, input.sucursalId);
        const repository = manager.getRepository(Vestido);
        await this.ensureUniqueCode(repository, input.codigo);

        return repository.save(
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
  ): Promise<void> {
    const duplicate = await repository.findOne({
      where: { codigo: ILike(codigo) },
    });

    if (duplicate) {
      throw new ConflictException(
        'Ya existe un vestido con ese código en la empresa',
      );
    }
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
