import { ConflictException, NotFoundException } from '@nestjs/common';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';
import { TenantContextService } from '../database/tenant-context.service.js';
import { Sucursal } from '../sucursales/entities/sucursal.tenant-entity.js';
import type { TenantScope } from '../tenancy/tenant-scope.js';
import type { CreateVestidoDto } from './dto/create-vestido.dto.js';
import {
  Vestido,
  VestidoEstadoOperativo,
} from './entities/vestido.tenant-entity.js';
import { VestidosService } from './vestidos.service.js';

describe('VestidosService', () => {
  const tenant = {
    empresaId: '019a6f33-82b7-4a22-971b-6a8d7c5e4f30',
    empresaSlug: 'atelier-norte',
    schemaName: 'tenant_019a6f3382b74a22971b6a8d7c5e4f30',
  } as TenantScope;
  const input: CreateVestidoDto = {
    sucursalId: 'a18c2a56-d33f-4d88-a8e7-42931121e295',
    codigo: 'V-001',
    nombre: 'Vestido Azul',
    talla: 'M',
    color: 'Azul',
    precioRenta: '1250.50',
    estadoOperativo: VestidoEstadoOperativo.DISPONIBLE,
  };

  function buildService(options?: {
    sucursal?: Sucursal | null;
    duplicate?: Vestido | null;
    saveError?: unknown;
  }) {
    const vestido = Object.assign(new Vestido(), {
      id: 'd18c2a56-d33f-4d88-a8e7-42931121e295',
      ...input,
      descripcion: null,
      marca: null,
      deposito: null,
      activo: true,
    });
    const sucursalFindOne = vi
      .fn()
      .mockResolvedValue(
        options && 'sucursal' in options
          ? options.sucursal
          : { id: input.sucursalId, activo: true },
      );
    const vestidoCreate = vi.fn().mockReturnValue(vestido);
    const sucursalRepository = {
      findOne: sucursalFindOne,
    } as unknown as Repository<Sucursal>;
    const vestidoRepository = {
      findOne: vi.fn().mockResolvedValue(options?.duplicate ?? null),
      create: vestidoCreate,
      save: options?.saveError
        ? vi.fn().mockRejectedValue(options.saveError)
        : vi.fn().mockResolvedValue(vestido),
    } as unknown as Repository<Vestido>;
    const manager = {
      getRepository: vi.fn((entity: typeof Sucursal | typeof Vestido) =>
        entity === Sucursal ? sucursalRepository : vestidoRepository,
      ),
    } as unknown as EntityManager;
    const run = vi.fn(
      async <T>(
        scope: TenantScope,
        operation: (entityManager: EntityManager) => Promise<T>,
      ) => {
        expect(scope).toBe(tenant);
        return operation(manager);
      },
    );
    const service = new VestidosService({
      run,
    } as unknown as TenantContextService);

    return {
      service,
      vestido,
      sucursalFindOne,
      vestidoCreate,
      vestidoRepository,
      run,
    };
  }

  it('creates a dress inside the authenticated tenant transaction', async () => {
    const { service, vestido, sucursalFindOne, vestidoCreate, run } =
      buildService();

    await expect(service.create(tenant, input)).resolves.toBe(vestido);
    expect(run).toHaveBeenCalledWith(tenant, expect.any(Function));
    expect(sucursalFindOne).toHaveBeenCalledWith({
      where: { id: input.sucursalId, activo: true },
    });
    expect(vestidoCreate).toHaveBeenCalledWith({
      ...input,
      descripcion: null,
      marca: null,
      deposito: null,
      activo: true,
    });
  });

  it('returns 404 for an absent or inactive branch', async () => {
    const { service } = buildService({ sucursal: null });

    await expect(service.create(tenant, input)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns 409 when the normalized code already exists', async () => {
    const { service } = buildService({
      duplicate: Object.assign(new Vestido(), { id: 'existing' }),
    });

    await expect(service.create(tenant, input)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('maps the database unique constraint to 409 for concurrent requests', async () => {
    const databaseError = new QueryFailedError(
      'INSERT',
      [],
      Object.assign(new Error('duplicate'), {
        code: '23505',
        constraint: 'UQ_vestidos_codigo_normalized',
      }),
    );
    const { service } = buildService({ saveError: databaseError });

    await expect(service.create(tenant, input)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
