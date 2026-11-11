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
import { TenantContextService } from '../database/tenant-context.service.js';
import { TenantMigrationService } from '../empresas/tenant-migrations/tenant-migration.service.js';
import { TenantResolverService } from '../tenancy/tenant-resolver.service.js';
import { CreateSucursalDto, UpdateSucursalDto } from './dto/sucursal.dto.js';
import { Sucursal } from './entities/sucursal.tenant-entity.js';

@Injectable()
export class SucursalesService {
  constructor(
    private readonly tenantResolver: TenantResolverService,
    private readonly tenantContext: TenantContextService,
    private readonly tenantMigrationService: TenantMigrationService,
  ) {}

  async create(
    empresaSlug: string,
    input: CreateSucursalDto,
  ): Promise<Sucursal> {
    try {
      return await this.withTenantRepository(
        empresaSlug,
        async (repository) => {
          await this.ensureUniqueName(repository, input.nombre);
          const sucursal = repository.create({
            nombre: input.nombre,
            direccion: input.direccion ?? null,
            telefono: input.telefono ?? null,
            activo: true,
          });
          return repository.save(sucursal);
        },
      );
    } catch (error) {
      this.rethrowNameConflict(error);
    }
  }

  findAll(empresaSlug: string): Promise<Sucursal[]> {
    return this.withTenantRepository(empresaSlug, (repository) =>
      repository.find({ order: { createdAt: 'DESC' } }),
    );
  }

  findOne(empresaSlug: string, id: string): Promise<Sucursal> {
    return this.withTenantRepository(empresaSlug, (repository) =>
      this.requireSucursal(repository, id),
    );
  }

  async update(
    empresaSlug: string,
    id: string,
    input: UpdateSucursalDto,
  ): Promise<Sucursal> {
    try {
      return await this.withTenantRepository(
        empresaSlug,
        async (repository) => {
          const sucursal = await this.requireSucursal(repository, id);

          if (input.nombre !== undefined && input.nombre !== sucursal.nombre) {
            await this.ensureUniqueName(repository, input.nombre, id);
            sucursal.nombre = input.nombre;
          }

          if (input.direccion !== undefined) {
            sucursal.direccion = input.direccion;
          }

          if (input.telefono !== undefined) {
            sucursal.telefono = input.telefono;
          }

          if (input.activo !== undefined) {
            sucursal.activo = input.activo;
          }

          return repository.save(sucursal);
        },
      );
    } catch (error) {
      this.rethrowNameConflict(error);
    }
  }

  deactivate(empresaSlug: string, id: string): Promise<Sucursal> {
    return this.withTenantRepository(empresaSlug, async (repository) => {
      const sucursal = await this.requireSucursal(repository, id);
      sucursal.activo = false;
      return repository.save(sucursal);
    });
  }

  private async withTenantRepository<T>(
    empresaSlug: string,
    operation: (repository: Repository<Sucursal>) => Promise<T>,
  ): Promise<T> {
    const tenant = await this.tenantResolver.resolveBySlug(empresaSlug);
    await this.tenantMigrationService.ensureMigrations(tenant.schemaName);

    return this.tenantContext.run(tenant, (manager: EntityManager) =>
      operation(manager.getRepository(Sucursal)),
    );
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
