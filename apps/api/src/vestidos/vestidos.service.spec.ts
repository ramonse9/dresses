import { ConflictException, NotFoundException } from '@nestjs/common';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';
import type { AuditService } from '../audit/audit.service.js';
import { TenantContextService } from '../database/tenant-context.service.js';
import { Sucursal } from '../sucursales/entities/sucursal.tenant-entity.js';
import type { TenantScope } from '../tenancy/tenant-scope.js';
import type { CreateVestidoDto } from './dto/create-vestido.dto.js';
import type { DisponibilidadVestidosQueryDto } from './dto/disponibilidad-vestidos-query.dto.js';
import type { ListVestidosQueryDto } from './dto/list-vestidos-query.dto.js';
import type { UpdateVestidoDto } from './dto/update-vestido.dto.js';
import {
  Vestido,
  VestidoEstadoOperativo,
} from './entities/vestido.tenant-entity.js';
import { VestidosService } from './vestidos.service.js';

describe('VestidosService', () => {
  const auditService = {
    record: vi.fn().mockResolvedValue({}),
  } as unknown as AuditService;
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
    const service = new VestidosService(
      {
        run,
      } as unknown as TenantContextService,
      auditService,
    );

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
    const select = vi.fn();
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
      select,
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
      select,
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
    const service = new VestidosService(
      {
        run,
      } as unknown as TenantContextService,
      auditService,
    );

    return {
      service,
      innerJoinAndSelect,
      select,
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

  function buildMutationService(options?: {
    existing?: Vestido | null;
    duplicate?: Vestido | null;
    destination?: Sucursal | null;
    saveError?: unknown;
  }) {
    const existing =
      options && 'existing' in options
        ? options.existing
        : Object.assign(new Vestido(), {
            id: 'd18c2a56-d33f-4d88-a8e7-42931121e295',
            ...input,
            descripcion: null,
            marca: null,
            deposito: null,
            activo: false,
          });
    const findOne = vi.fn(async (query: { where?: { id?: unknown } }) =>
      typeof query.where?.id === 'string'
        ? existing
        : (options?.duplicate ?? null),
    );
    const save = options?.saveError
      ? vi.fn().mockRejectedValue(options.saveError)
      : vi.fn(async (vestido: Vestido) => vestido);
    const vestidoRepository = {
      findOne,
      save,
    } as unknown as Repository<Vestido>;
    const sucursalFindOne = vi
      .fn()
      .mockResolvedValue(
        options && 'destination' in options
          ? options.destination
          : { id: 'b18c2a56-d33f-4d88-a8e7-42931121e295', activo: true },
      );
    const sucursalRepository = {
      findOne: sucursalFindOne,
    } as unknown as Repository<Sucursal>;
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

    return {
      service: new VestidosService(
        { run } as unknown as TenantContextService,
        auditService,
      ),
      existing,
      findOne,
      save,
      sucursalFindOne,
      run,
    };
  }

  function buildAvailabilityService(options?: {
    sucursal?: Sucursal | null;
    vestidos?: Vestido[];
    total?: number;
  }) {
    const sucursalFindOne = vi
      .fn()
      .mockResolvedValue(
        options && 'sucursal' in options
          ? options.sucursal
          : { id: input.sucursalId, activo: true },
      );
    const innerJoinAndSelect = vi.fn();
    const select = vi.fn();
    const where = vi.fn();
    const andWhere = vi.fn();
    const orderBy = vi.fn();
    const addOrderBy = vi.fn();
    const skip = vi.fn();
    const take = vi.fn();
    const getManyAndCount = vi
      .fn()
      .mockResolvedValue([options?.vestidos ?? [], options?.total ?? 0]);
    const builder = {
      innerJoinAndSelect,
      select,
      where,
      andWhere,
      orderBy,
      addOrderBy,
      skip,
      take,
      getManyAndCount,
    };

    for (const method of [
      innerJoinAndSelect,
      select,
      where,
      andWhere,
      orderBy,
      addOrderBy,
      skip,
      take,
    ]) {
      method.mockReturnValue(builder);
    }

    const createQueryBuilder = vi.fn().mockReturnValue(builder);
    const manager = {
      getRepository: vi.fn((entity: typeof Sucursal | typeof Vestido) =>
        entity === Sucursal
          ? { findOne: sucursalFindOne }
          : { createQueryBuilder },
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

    return {
      service: new VestidosService(
        { run } as unknown as TenantContextService,
        auditService,
      ),
      run,
      sucursalFindOne,
      createQueryBuilder,
      innerJoinAndSelect,
      select,
      where,
      andWhere,
      orderBy,
      addOrderBy,
      skip,
      take,
      getManyAndCount,
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

  it('returns an available page with one catalog query and no N+1', async () => {
    const vestido = buildCatalogVestido();
    const context = buildAvailabilityService({
      vestidos: [vestido],
      total: 21,
    });
    const filters: DisponibilidadVestidosQueryDto = {
      sucursalId: input.sucursalId,
      fechaInicio: new Date('2026-12-10T23:00:00.000Z'),
      fechaFin: new Date('2026-12-12T23:00:00.000Z'),
      talla: 'M',
      color: 'Azul',
      estadoOperativo: VestidoEstadoOperativo.DISPONIBLE,
      page: 2,
      limit: 20,
    };

    await expect(
      context.service.findAvailability(tenant, filters),
    ).resolves.toEqual({
      data: [expect.objectContaining({ id: vestido.id })],
      pagination: { page: 2, limit: 20, total: 21, totalPages: 2 },
      range: {
        fechaInicio: filters.fechaInicio,
        fechaFin: filters.fechaFin,
      },
    });
    expect(context.run).toHaveBeenCalledOnce();
    expect(context.sucursalFindOne).toHaveBeenCalledWith({
      where: { id: input.sucursalId, activo: true },
    });
    expect(context.createQueryBuilder).toHaveBeenCalledOnce();
    expect(context.getManyAndCount).toHaveBeenCalledOnce();
    expect(context.innerJoinAndSelect).toHaveBeenCalledWith(
      'vestido.sucursal',
      'sucursal',
    );
    expect(context.where).toHaveBeenCalledWith(
      'vestido.sucursalId = :sucursalId',
      { sucursalId: input.sucursalId },
    );
    expect(context.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('NOT EXISTS'),
      expect.objectContaining({
        fechaInicio: filters.fechaInicio,
        fechaFin: filters.fechaFin,
      }),
    );
    expect(context.andWhere).toHaveBeenCalledWith(
      'LOWER(vestido.talla) = LOWER(:talla)',
      { talla: 'M' },
    );
    expect(context.andWhere).toHaveBeenCalledWith(
      'LOWER(vestido.color) = LOWER(:color)',
      { color: 'Azul' },
    );
    expect(context.orderBy).toHaveBeenCalledWith('vestido.createdAt', 'DESC');
    expect(context.addOrderBy).toHaveBeenCalledWith('vestido.id', 'DESC');
    expect(context.skip).toHaveBeenCalledWith(20);
    expect(context.take).toHaveBeenCalledWith(20);
  });

  it('returns 404 before querying dresses for an inactive or foreign branch', async () => {
    const context = buildAvailabilityService({ sucursal: null });

    await expect(
      context.service.findAvailability(tenant, {
        sucursalId: input.sucursalId,
        fechaInicio: new Date('2026-12-10T23:00:00.000Z'),
        fechaFin: new Date('2026-12-12T23:00:00.000Z'),
        estadoOperativo: VestidoEstadoOperativo.DISPONIBLE,
        page: 1,
        limit: 20,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(context.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('updates, transfers and reactivates a dress in one tenant transaction', async () => {
    const { service, existing, findOne, save, sucursalFindOne, run } =
      buildMutationService();
    const update: UpdateVestidoDto = {
      sucursalId: 'b18c2a56-d33f-4d88-a8e7-42931121e295',
      codigo: 'V-002',
      nombre: 'Vestido Rojo',
      descripcion: 'Nuevo corte',
      talla: 'L',
      color: 'Rojo',
      marca: 'Luna',
      precioRenta: '1500.00',
      deposito: '250.00',
      estadoOperativo: VestidoEstadoOperativo.MANTENIMIENTO,
      activo: true,
    };

    await expect(
      service.update(tenant, existing!.id, update),
    ).resolves.toMatchObject(update);
    expect(run).toHaveBeenCalledOnce();
    expect(sucursalFindOne).toHaveBeenCalledWith({
      where: { id: update.sucursalId, activo: true },
    });
    expect(findOne).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenCalledWith(existing);
    expect(existing).toMatchObject(update);
  });

  it('rejects a duplicate code during update', async () => {
    const { service, existing } = buildMutationService({
      duplicate: Object.assign(new Vestido(), { id: 'duplicate' }),
    });

    await expect(
      service.update(tenant, existing!.id, { codigo: 'V-002' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a transfer to an absent or inactive branch', async () => {
    const { service, existing } = buildMutationService({ destination: null });

    await expect(
      service.update(tenant, existing!.id, {
        sucursalId: 'b18c2a56-d33f-4d88-a8e7-42931121e295',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('soft-deletes a dress without removing it', async () => {
    const { service, existing, save } = buildMutationService();
    existing!.activo = true;

    await expect(
      service.deactivate(tenant, existing!.id),
    ).resolves.toMatchObject({ activo: false });
    expect(save).toHaveBeenCalledWith(existing);
  });

  it('returns 404 when updating or deactivating a foreign dress', async () => {
    const { service } = buildMutationService({ existing: null });

    await expect(
      service.update(tenant, 'd18c2a56-d33f-4d88-a8e7-42931121e295', {
        nombre: 'No permitido',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.deactivate(tenant, 'd18c2a56-d33f-4d88-a8e7-42931121e295'),
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
