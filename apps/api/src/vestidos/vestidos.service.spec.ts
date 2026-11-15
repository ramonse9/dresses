import { ConflictException, NotFoundException } from '@nestjs/common';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';
import { TenantContextService } from '../database/tenant-context.service.js';
import { Sucursal } from '../sucursales/entities/sucursal.tenant-entity.js';
import type { TenantScope } from '../tenancy/tenant-scope.js';
import type { CreateVestidoDto } from './dto/create-vestido.dto.js';
import type { ListVestidosQueryDto } from './dto/list-vestidos-query.dto.js';
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

  function buildQueryService(options?: {
    vestidos?: Vestido[];
    total?: number;
    vestido?: Vestido | null;
  }) {
    const innerJoinAndSelect = vi.fn();
    const andWhere = vi.fn();
    const orderBy = vi.fn();
    const addOrderBy = vi.fn();
    const skip = vi.fn();
    const take = vi.fn();
    const where = vi.fn();
    const getManyAndCount = vi
      .fn()
      .mockResolvedValue([options?.vestidos ?? [], options?.total ?? 0]);
    const getOne = vi.fn().mockResolvedValue(options?.vestido ?? null);
    const builder = {
      innerJoinAndSelect,
      andWhere,
      orderBy,
      addOrderBy,
      skip,
      take,
      where,
      getManyAndCount,
      getOne,
    };

    for (const method of [
      innerJoinAndSelect,
      andWhere,
      orderBy,
      addOrderBy,
      skip,
      take,
      where,
    ]) {
      method.mockReturnValue(builder);
    }

    const createQueryBuilder = vi.fn().mockReturnValue(builder);
    const manager = {
      getRepository: vi.fn(() => ({ createQueryBuilder })),
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
      innerJoinAndSelect,
      andWhere,
      orderBy,
      addOrderBy,
      skip,
      take,
      where,
      getManyAndCount,
      getOne,
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

  it('returns a filtered page with one joined sucursal query', async () => {
    const vestido = buildCatalogVestido();
    const {
      service,
      innerJoinAndSelect,
      andWhere,
      orderBy,
      addOrderBy,
      skip,
      take,
      getManyAndCount,
    } = buildQueryService({ vestidos: [vestido], total: 21 });
    const filters: ListVestidosQueryDto = {
      page: 2,
      limit: 20,
      sucursalId: input.sucursalId,
      activo: true,
      estadoOperativo: VestidoEstadoOperativo.DISPONIBLE,
      q: 'Azul%_\\',
    };

    await expect(service.findAll(tenant, filters)).resolves.toEqual({
      data: [
        expect.objectContaining({
          id: vestido.id,
          sucursal: {
            id: vestido.sucursal.id,
            nombre: vestido.sucursal.nombre,
            activo: true,
          },
        }),
      ],
      pagination: { page: 2, limit: 20, total: 21, totalPages: 2 },
    });
    expect(innerJoinAndSelect).toHaveBeenCalledWith(
      'vestido.sucursal',
      'sucursal',
    );
    expect(andWhere).toHaveBeenCalledWith('vestido.sucursalId = :sucursalId', {
      sucursalId: input.sucursalId,
    });
    expect(andWhere).toHaveBeenCalledWith('vestido.activo = :activo', {
      activo: true,
    });
    expect(andWhere).toHaveBeenCalledWith(
      'vestido.estadoOperativo = :estadoOperativo',
      { estadoOperativo: VestidoEstadoOperativo.DISPONIBLE },
    );
    expect(andWhere).toHaveBeenCalledWith(expect.stringContaining('ILIKE'), {
      search: '%Azul\\%\\_\\\\%',
    });
    expect(orderBy).toHaveBeenCalledWith('vestido.createdAt', 'DESC');
    expect(addOrderBy).toHaveBeenCalledWith('vestido.id', 'DESC');
    expect(skip).toHaveBeenCalledWith(20);
    expect(take).toHaveBeenCalledWith(20);
    expect(getManyAndCount).toHaveBeenCalledOnce();
  });

  it('returns one dress without exposing tenant schema data', async () => {
    const vestido = buildCatalogVestido();
    const { service, innerJoinAndSelect, where, getOne } = buildQueryService({
      vestido,
    });

    const result = await service.findOne(tenant, vestido.id);

    expect(result).toMatchObject({
      id: vestido.id,
      sucursal: { id: vestido.sucursal.id, nombre: 'Centro', activo: true },
    });
    expect(JSON.stringify(result)).not.toContain('tenant_');
    expect(JSON.stringify(result)).not.toContain('schemaName');
    expect(innerJoinAndSelect).toHaveBeenCalledWith(
      'vestido.sucursal',
      'sucursal',
    );
    expect(where).toHaveBeenCalledWith('vestido.id = :id', {
      id: vestido.id,
    });
    expect(getOne).toHaveBeenCalledOnce();
  });

  it('returns 404 when a dress is absent from the authenticated tenant', async () => {
    const { service } = buildQueryService({ vestido: null });

    await expect(
      service.findOne(tenant, 'd18c2a56-d33f-4d88-a8e7-42931121e295'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

function buildCatalogVestido(): Vestido {
  return Object.assign(new Vestido(), {
    id: 'd18c2a56-d33f-4d88-a8e7-42931121e295',
    sucursalId: 'a18c2a56-d33f-4d88-a8e7-42931121e295',
    codigo: 'V-001',
    nombre: 'Vestido Azul',
    descripcion: null,
    talla: 'M',
    color: 'Azul',
    marca: 'Marca',
    precioRenta: '1250.50',
    deposito: null,
    estadoOperativo: VestidoEstadoOperativo.DISPONIBLE,
    activo: true,
    createdAt: new Date('2026-11-14T12:00:00.000Z'),
    updatedAt: new Date('2026-11-14T12:00:00.000Z'),
    sucursal: {
      id: 'a18c2a56-d33f-4d88-a8e7-42931121e295',
      nombre: 'Centro',
      activo: true,
    } as Sucursal,
  });
}
