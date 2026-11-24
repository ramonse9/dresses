import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import type { AuditService } from '../audit/audit.service.js';
import { TenantContextService } from '../database/tenant-context.service.js';
import type { TenantScope } from '../tenancy/tenant-scope.js';
import { ClientesService } from './clientes.service.js';
import { Cliente } from './entities/cliente.tenant-entity.js';

describe('ClientesService', () => {
  const tenant = {
    empresaId: '019a6f33-82b7-4a22-971b-6a8d7c5e4f30',
    empresaSlug: 'atelier-norte',
    schemaName: 'tenant_019a6f3382b74a22971b6a8d7c5e4f30',
  } as TenantScope;

  function buildService(options?: {
    existing?: Cliente | null;
    page?: Cliente[];
    total?: number;
  }) {
    const existing =
      options && 'existing' in options
        ? options.existing
        : Object.assign(new Cliente(), {
            id: 'a18c2a56-d33f-4d88-a8e7-42931121e295',
            nombre: 'Ana López',
            telefono: '555-0100',
            email: null,
            direccion: null,
            notas: null,
            activo: true,
          });
    const create = vi.fn((value: Partial<Cliente>) =>
      Object.assign(new Cliente(), value, {
        id: 'b18c2a56-d33f-4d88-a8e7-42931121e295',
      }),
    );
    const save = vi.fn(async (cliente: Cliente) => cliente);
    const findOne = vi.fn().mockResolvedValue(existing);
    const andWhere = vi.fn();
    const orderBy = vi.fn();
    const addOrderBy = vi.fn();
    const skip = vi.fn();
    const take = vi.fn();
    const getManyAndCount = vi
      .fn()
      .mockResolvedValue([options?.page ?? [], options?.total ?? 0]);
    const builder = {
      andWhere,
      orderBy,
      addOrderBy,
      skip,
      take,
      getManyAndCount,
    };

    for (const method of [andWhere, orderBy, addOrderBy, skip, take]) {
      method.mockReturnValue(builder);
    }

    const createQueryBuilder = vi.fn().mockReturnValue(builder);
    const repository = {
      create,
      save,
      findOne,
      createQueryBuilder,
    } as unknown as Repository<Cliente>;
    const manager = {
      getRepository: vi.fn().mockReturnValue(repository),
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
    const record = vi.fn().mockResolvedValue({});

    return {
      service: new ClientesService(
        { run } as unknown as TenantContextService,
        { record } as unknown as AuditService,
      ),
      existing,
      create,
      save,
      findOne,
      andWhere,
      orderBy,
      addOrderBy,
      skip,
      take,
      getManyAndCount,
      run,
      record,
    };
  }

  it('creates a normalized DTO inside the authenticated tenant', async () => {
    const { service, create, save, run } = buildService();

    await service.create(tenant, {
      nombre: 'Ana López',
      email: 'ana@example.com',
    });

    expect(run).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledWith({
      nombre: 'Ana López',
      telefono: null,
      email: 'ana@example.com',
      direccion: null,
      notas: null,
      activo: true,
    });
    expect(save).toHaveBeenCalledOnce();
  });

  it('returns a filtered, stable and paginated list', async () => {
    const cliente = Object.assign(new Cliente(), { id: 'cliente-id' });
    const {
      service,
      andWhere,
      orderBy,
      addOrderBy,
      skip,
      take,
      getManyAndCount,
    } = buildService({ page: [cliente], total: 21 });

    await expect(
      service.findAll(tenant, {
        page: 2,
        limit: 20,
        activo: false,
        q: 'Ana%_\\',
      }),
    ).resolves.toEqual({
      data: [cliente],
      pagination: { page: 2, limit: 20, total: 21, totalPages: 2 },
    });
    expect(andWhere).toHaveBeenCalledWith('cliente.activo = :activo', {
      activo: false,
    });
    expect(andWhere).toHaveBeenCalledWith(expect.stringContaining('ILIKE'), {
      search: '%Ana\\%\\_\\\\%',
    });
    expect(orderBy).toHaveBeenCalledWith('cliente.createdAt', 'DESC');
    expect(addOrderBy).toHaveBeenCalledWith('cliente.id', 'DESC');
    expect(skip).toHaveBeenCalledWith(20);
    expect(take).toHaveBeenCalledWith(20);
    expect(getManyAndCount).toHaveBeenCalledOnce();
  });

  it('updates data while preserving at least one contact', async () => {
    const { service, existing, save } = buildService();

    await expect(
      service.update(tenant, existing!.id, {
        nombre: 'Ana Actualizada',
        telefono: null,
        email: 'ana@example.com',
        notas: 'Frecuente',
      }),
    ).resolves.toMatchObject({
      nombre: 'Ana Actualizada',
      telefono: null,
      email: 'ana@example.com',
      notas: 'Frecuente',
    });
    expect(save).toHaveBeenCalledWith(existing);
  });

  it('rejects removing both contact methods from the final state', async () => {
    const existing = Object.assign(new Cliente(), {
      id: 'a18c2a56-d33f-4d88-a8e7-42931121e295',
      nombre: 'Ana',
      telefono: '555-0100',
      email: 'ana@example.com',
      activo: true,
    });
    const { service, save } = buildService({ existing });

    await expect(
      service.update(tenant, existing.id, { telefono: null, email: null }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(save).not.toHaveBeenCalled();
  });

  it('changes status and performs soft deletion', async () => {
    const first = buildService();
    await expect(
      first.service.updateEstado(tenant, first.existing!.id, false),
    ).resolves.toMatchObject({ activo: false });
    expect(first.save).toHaveBeenCalledWith(first.existing);

    const second = buildService();
    await expect(
      second.service.deactivate(tenant, second.existing!.id),
    ).resolves.toMatchObject({ activo: false });
    expect(second.save).toHaveBeenCalledWith(second.existing);
  });

  it('returns 404 for a client absent from the authenticated tenant', async () => {
    const { service } = buildService({ existing: null });

    await expect(
      service.findOne(tenant, 'a18c2a56-d33f-4d88-a8e7-42931121e295'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.updateEstado(
        tenant,
        'a18c2a56-d33f-4d88-a8e7-42931121e295',
        true,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
