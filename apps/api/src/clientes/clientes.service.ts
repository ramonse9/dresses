import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
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
import type {
  CreateClienteDto,
  ListClientesQueryDto,
  PaginatedClientesResponseDto,
  UpdateClienteDto,
} from './dto/cliente.dto.js';
import { Cliente } from './entities/cliente.tenant-entity.js';

@Injectable()
export class ClientesService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly auditService: AuditService,
  ) {}

  create(
    tenant: TenantScope,
    input: CreateClienteDto,
    actor?: AuthenticatedAuditActor,
  ): Promise<Cliente> {
    return this.withTenantManager(tenant, async (manager) => {
      const repository = manager.getRepository(Cliente);
      const saved = await repository.save(
        repository.create({
          nombre: input.nombre,
          telefono: input.telefono ?? null,
          email: input.email ?? null,
          direccion: input.direccion ?? null,
          notas: input.notas ?? null,
          activo: true,
        }),
      );
      await this.auditService.record(
        {
          empresaId: tenant.empresaId,
          actorUsuarioId: actor?.actorUsuarioId ?? null,
          sessionId: actor?.sessionId ?? null,
          action: AUDIT_ACTIONS.CUSTOMER_CREATED,
          resourceType: AUDIT_RESOURCE_TYPES.CUSTOMER,
          resourceId: saved.id,
          metadata: { initialActive: true },
          safeMetadataFields: ['initialActive'],
        },
        manager,
      );
      return saved;
    });
  }

  findAll(
    tenant: TenantScope,
    input: ListClientesQueryDto,
  ): Promise<PaginatedClientesResponseDto> {
    return this.withTenantRepository(tenant, async (repository) => {
      const query = repository.createQueryBuilder('cliente');

      if (input.activo !== undefined) {
        query.andWhere('cliente.activo = :activo', { activo: input.activo });
      }
      if (input.q !== undefined) {
        query.andWhere(
          `(cliente.nombre ILIKE :search ESCAPE '\\' OR cliente.email ILIKE :search ESCAPE '\\' OR cliente.telefono ILIKE :search ESCAPE '\\')`,
          { search: `%${this.escapeLikePattern(input.q)}%` },
        );
      }

      const [clientes, total] = await query
        .orderBy('cliente.createdAt', 'DESC')
        .addOrderBy('cliente.id', 'DESC')
        .skip((input.page - 1) * input.limit)
        .take(input.limit)
        .getManyAndCount();

      return {
        data: clientes,
        pagination: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(total / input.limit),
        },
      };
    });
  }

  findOne(tenant: TenantScope, id: string): Promise<Cliente> {
    return this.withTenantRepository(tenant, (repository) =>
      this.requireCliente(repository, id),
    );
  }

  update(
    tenant: TenantScope,
    id: string,
    input: UpdateClienteDto,
    actor?: AuthenticatedAuditActor,
  ): Promise<Cliente> {
    return this.withTenantManager(tenant, async (manager) => {
      const repository = manager.getRepository(Cliente);
      const cliente = await this.requireCliente(repository, id);
      const telefono =
        input.telefono !== undefined ? input.telefono : cliente.telefono;
      const email = input.email !== undefined ? input.email : cliente.email;

      if (!telefono && !email) {
        throw new BadRequestException('Se requiere telefono o email');
      }

      const changedFields: string[] = [];
      const changes: Record<string, unknown> = {};

      if (input.nombre !== undefined && input.nombre !== cliente.nombre) {
        changedFields.push('nombre');
        changes.nombre = { previous: cliente.nombre, new: input.nombre };
        cliente.nombre = input.nombre;
      }
      if (input.telefono !== undefined && input.telefono !== cliente.telefono) {
        changedFields.push('telefono');
        cliente.telefono = input.telefono;
      }
      if (input.email !== undefined && input.email !== cliente.email) {
        changedFields.push('email');
        cliente.email = input.email;
      }
      if (
        input.direccion !== undefined &&
        input.direccion !== cliente.direccion
      ) {
        changedFields.push('direccion');
        cliente.direccion = input.direccion;
      }
      if (input.notas !== undefined && input.notas !== cliente.notas) {
        changedFields.push('notas');
        cliente.notas = input.notas;
      }

      if (changedFields.length === 0) {
        return cliente;
      }
      const saved = await repository.save(cliente);
      await this.auditService.record(
        {
          empresaId: tenant.empresaId,
          actorUsuarioId: actor?.actorUsuarioId ?? null,
          sessionId: actor?.sessionId ?? null,
          action: AUDIT_ACTIONS.CUSTOMER_UPDATED,
          resourceType: AUDIT_RESOURCE_TYPES.CUSTOMER,
          resourceId: saved.id,
          metadata: { changedFields, changes },
          safeMetadataFields: ['changedFields', 'changes'],
        },
        manager,
      );
      return saved;
    });
  }

  updateEstado(
    tenant: TenantScope,
    id: string,
    activo: boolean,
    actor?: AuthenticatedAuditActor,
  ): Promise<Cliente> {
    return this.withTenantManager(tenant, async (manager) => {
      const repository = manager.getRepository(Cliente);
      const cliente = await this.requireCliente(repository, id);
      if (cliente.activo === activo) {
        return cliente;
      }
      const previousActive = cliente.activo;
      cliente.activo = activo;
      const saved = await repository.save(cliente);
      await this.auditService.record(
        {
          empresaId: tenant.empresaId,
          actorUsuarioId: actor?.actorUsuarioId ?? null,
          sessionId: actor?.sessionId ?? null,
          action: activo
            ? AUDIT_ACTIONS.CUSTOMER_ACTIVATED
            : AUDIT_ACTIONS.CUSTOMER_DEACTIVATED,
          resourceType: AUDIT_RESOURCE_TYPES.CUSTOMER,
          resourceId: saved.id,
          metadata: { previousActive, newActive: activo },
          safeMetadataFields: ['previousActive', 'newActive'],
        },
        manager,
      );
      return saved;
    });
  }

  deactivate(
    tenant: TenantScope,
    id: string,
    actor?: AuthenticatedAuditActor,
  ): Promise<Cliente> {
    return this.updateEstado(tenant, id, false, actor);
  }

  private withTenantRepository<T>(
    tenant: TenantScope,
    operation: (repository: Repository<Cliente>) => Promise<T>,
  ): Promise<T> {
    return this.withTenantManager(tenant, (manager) =>
      operation(manager.getRepository(Cliente)),
    );
  }

  private withTenantManager<T>(
    tenant: TenantScope,
    operation: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.tenantContext.run(tenant, operation);
  }

  private async requireCliente(
    repository: Repository<Cliente>,
    id: string,
  ): Promise<Cliente> {
    const cliente = await repository.findOne({ where: { id } });

    if (!cliente) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return cliente;
  }

  private escapeLikePattern(value: string): string {
    return value
      .replaceAll('\\', '\\\\')
      .replaceAll('%', '\\%')
      .replaceAll('_', '\\_');
  }
}
