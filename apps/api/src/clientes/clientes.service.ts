import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
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
  constructor(private readonly tenantContext: TenantContextService) {}

  create(tenant: TenantScope, input: CreateClienteDto): Promise<Cliente> {
    return this.withTenantRepository(tenant, (repository) =>
      repository.save(
        repository.create({
          nombre: input.nombre,
          telefono: input.telefono ?? null,
          email: input.email ?? null,
          direccion: input.direccion ?? null,
          notas: input.notas ?? null,
          activo: true,
        }),
      ),
    );
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
  ): Promise<Cliente> {
    return this.withTenantRepository(tenant, async (repository) => {
      const cliente = await this.requireCliente(repository, id);
      const telefono =
        input.telefono !== undefined ? input.telefono : cliente.telefono;
      const email = input.email !== undefined ? input.email : cliente.email;

      if (!telefono && !email) {
        throw new BadRequestException('Se requiere telefono o email');
      }

      if (input.nombre !== undefined) {
        cliente.nombre = input.nombre;
      }
      if (input.telefono !== undefined) {
        cliente.telefono = input.telefono;
      }
      if (input.email !== undefined) {
        cliente.email = input.email;
      }
      if (input.direccion !== undefined) {
        cliente.direccion = input.direccion;
      }
      if (input.notas !== undefined) {
        cliente.notas = input.notas;
      }

      return repository.save(cliente);
    });
  }

  updateEstado(
    tenant: TenantScope,
    id: string,
    activo: boolean,
  ): Promise<Cliente> {
    return this.withTenantRepository(tenant, async (repository) => {
      const cliente = await this.requireCliente(repository, id);
      cliente.activo = activo;
      return repository.save(cliente);
    });
  }

  deactivate(tenant: TenantScope, id: string): Promise<Cliente> {
    return this.updateEstado(tenant, id, false);
  }

  private withTenantRepository<T>(
    tenant: TenantScope,
    operation: (repository: Repository<Cliente>) => Promise<T>,
  ): Promise<T> {
    return this.tenantContext.run(tenant, (manager: EntityManager) =>
      operation(manager.getRepository(Cliente)),
    );
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
