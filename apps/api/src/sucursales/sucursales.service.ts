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
import type { TenantScope } from '../tenancy/tenant-scope.js';
import { CreateSucursalDto, UpdateSucursalDto } from './dto/sucursal.dto.js';
import { Sucursal } from './entities/sucursal.tenant-entity.js';

@Injectable()
export class SucursalesService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    tenant: TenantScope,
    input: CreateSucursalDto,
    actor?: AuthenticatedAuditActor,
  ): Promise<Sucursal> {
    try {
      return await this.withTenantManager(tenant, async (manager) => {
        const repository = manager.getRepository(Sucursal);
        await this.ensureUniqueName(repository, input.nombre);
        const sucursal = repository.create({
          nombre: input.nombre,
          direccion: input.direccion ?? null,
          telefono: input.telefono ?? null,
          activo: true,
        });
        const saved = await repository.save(sucursal);
        await this.auditService.record(
          {
            empresaId: tenant.empresaId,
            actorUsuarioId: actor?.actorUsuarioId ?? null,
            sessionId: actor?.sessionId ?? null,
            action: AUDIT_ACTIONS.BRANCH_CREATED,
            resourceType: AUDIT_RESOURCE_TYPES.BRANCH,
            resourceId: saved.id,
            metadata: { initialActive: true },
            safeMetadataFields: ['initialActive'],
          },
          manager,
        );
        return saved;
      });
    } catch (error) {
      this.rethrowNameConflict(error);
    }
  }

  findAll(tenant: TenantScope): Promise<Sucursal[]> {
    return this.withTenantRepository(tenant, (repository) =>
      repository.find({ order: { createdAt: 'DESC' } }),
    );
  }

  findOne(tenant: TenantScope, id: string): Promise<Sucursal> {
    return this.withTenantRepository(tenant, (repository) =>
      this.requireSucursal(repository, id),
    );
  }

  async update(
    tenant: TenantScope,
    id: string,
    input: UpdateSucursalDto,
    actor?: AuthenticatedAuditActor,
  ): Promise<Sucursal> {
    try {
      return await this.withTenantManager(tenant, async (manager) => {
        const repository = manager.getRepository(Sucursal);
        const sucursal = await this.requireSucursal(repository, id);
        const changedFields: string[] = [];
        const changes: Record<string, unknown> = {};
        const previousActive = sucursal.activo;

        if (input.nombre !== undefined && input.nombre !== sucursal.nombre) {
          await this.ensureUniqueName(repository, input.nombre, id);
          changedFields.push('nombre');
          changes.nombre = { previous: sucursal.nombre, new: input.nombre };
          sucursal.nombre = input.nombre;
        }

        if (
          input.direccion !== undefined &&
          input.direccion !== sucursal.direccion
        ) {
          changedFields.push('direccion');
          sucursal.direccion = input.direccion;
        }

        if (
          input.telefono !== undefined &&
          input.telefono !== sucursal.telefono
        ) {
          changedFields.push('telefono');
          sucursal.telefono = input.telefono;
        }

        if (input.activo !== undefined && input.activo !== sucursal.activo) {
          sucursal.activo = input.activo;
        }

        const activeChanged = sucursal.activo !== previousActive;
        if (changedFields.length === 0 && !activeChanged) {
          return sucursal;
        }

        const saved = await repository.save(sucursal);
        if (changedFields.length > 0) {
          await this.auditService.record(
            {
              empresaId: tenant.empresaId,
              actorUsuarioId: actor?.actorUsuarioId ?? null,
              sessionId: actor?.sessionId ?? null,
              action: AUDIT_ACTIONS.BRANCH_UPDATED,
              resourceType: AUDIT_RESOURCE_TYPES.BRANCH,
              resourceId: saved.id,
              metadata: { changedFields, changes },
              safeMetadataFields: ['changedFields', 'changes'],
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
      this.rethrowNameConflict(error);
    }
  }

  deactivate(
    tenant: TenantScope,
    id: string,
    actor?: AuthenticatedAuditActor,
  ): Promise<Sucursal> {
    return this.withTenantManager(tenant, async (manager) => {
      const repository = manager.getRepository(Sucursal);
      const sucursal = await this.requireSucursal(repository, id);
      if (!sucursal.activo) {
        return sucursal;
      }
      sucursal.activo = false;
      const saved = await repository.save(sucursal);
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
          ? AUDIT_ACTIONS.BRANCH_ACTIVATED
          : AUDIT_ACTIONS.BRANCH_DEACTIVATED,
        resourceType: AUDIT_RESOURCE_TYPES.BRANCH,
        resourceId,
        metadata: { previousActive, newActive },
        safeMetadataFields: ['previousActive', 'newActive'],
      },
      manager,
    );
  }

  private async withTenantRepository<T>(
    tenant: TenantScope,
    operation: (repository: Repository<Sucursal>) => Promise<T>,
  ): Promise<T> {
    return this.withTenantManager(tenant, (manager) =>
      operation(manager.getRepository(Sucursal)),
    );
  }

  private withTenantManager<T>(
    tenant: TenantScope,
    operation: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.tenantContext.run(tenant, operation);
  }

  private async requireSucursal(
    repository: Repository<Sucursal>,
    id: string,
  ): Promise<Sucursal> {
    const sucursal = await repository.findOne({ where: { id } });

    if (!sucursal) {
      throw new NotFoundException('Sucursal no encontrada');
    }

    return sucursal;
  }

  private async ensureUniqueName(
    repository: Repository<Sucursal>,
    nombre: string,
    excludedId?: string,
  ): Promise<void> {
    const duplicate = await repository.findOne({
      where: {
        nombre: ILike(nombre),
        ...(excludedId ? { id: Not(excludedId) } : {}),
      },
    });

    if (duplicate) {
      throw new ConflictException(
        'Ya existe una sucursal con ese nombre en la empresa',
      );
    }
  }

  private rethrowNameConflict(error: unknown): never {
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
        driverError.constraint === 'UQ_sucursales_nombre_normalized'
      ) {
        throw new ConflictException(
          'Ya existe una sucursal con ese nombre en la empresa',
        );
      }
    }

    throw error;
  }
}
