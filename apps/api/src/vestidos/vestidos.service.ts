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
}
