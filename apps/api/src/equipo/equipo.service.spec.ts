import { NotFoundException } from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';
import { EmpresaUsuarioRol } from '../usuarios/entities/empresa-usuario.entity.js';
import { EmpresaUsuario } from '../usuarios/entities/empresa-usuario.entity.js';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import { EquipoService } from './equipo.service.js';

describe('EquipoService', () => {
  const empresaId = 'a18c2a56-d33f-4d88-a8e7-42931121e295';
  const createdAt = new Date('2026-11-20T12:00:00.000Z');
  const usuario = Object.assign(new Usuario(), {
    id: 'b18c2a56-d33f-4d88-a8e7-42931121e295',
    email: 'owner@example.com',
    passwordHash: 'never-expose-this',
    nombre: 'Owner',
    activo: false,
    authSessions: [{ refreshTokenHash: 'never-expose-this-either' }],
  });
  const membresia = Object.assign(new EmpresaUsuario(), {
    id: 'c18c2a56-d33f-4d88-a8e7-42931121e295',
    empresaId,
    usuarioId: usuario.id,
    usuario,
    rol: EmpresaUsuarioRol.OWNER,
    activo: true,
    createdAt,
  });

  function createBuilder(options: {
    list?: EmpresaUsuario[];
    total?: number;
    one?: EmpresaUsuario | null;
  }) {
    const builder = {
      innerJoinAndSelect: vi.fn(),
      where: vi.fn(),
      andWhere: vi.fn(),
      orderBy: vi.fn(),
      addOrderBy: vi.fn(),
      skip: vi.fn(),
      take: vi.fn(),
      getManyAndCount: vi
        .fn()
        .mockResolvedValue([options.list ?? [], options.total ?? 0]),
      getOne: vi.fn().mockResolvedValue(options.one ?? null),
    };

    for (const method of [
      builder.innerJoinAndSelect,
      builder.where,
      builder.andWhere,
      builder.orderBy,
      builder.addOrderBy,
      builder.skip,
      builder.take,
    ]) {
      method.mockReturnValue(builder);
    }

    return builder;
  }

  it('scopes, filters and safely projects the paginated list', async () => {
    const builder = createBuilder({ list: [membresia], total: 1 });
    const repository = {
      createQueryBuilder: vi.fn().mockReturnValue(builder),
    } as unknown as Repository<EmpresaUsuario>;
    const service = new EquipoService(repository, {} as DataSource);

    const result = await service.findAll(empresaId, {
      page: 2,
      limit: 10,
      rol: EmpresaUsuarioRol.OWNER,
      activo: true,
      q: 'owner_%',
    });

    expect(builder.where).toHaveBeenCalledWith(
      'membresia.empresaId = :empresaId',
      { empresaId },
    );
    expect(builder.andWhere).toHaveBeenCalledWith('membresia.rol = :rol', {
      rol: EmpresaUsuarioRol.OWNER,
    });
    expect(builder.andWhere).toHaveBeenCalledWith(
      'membresia.activo = :activo',
      { activo: true },
    );
    expect(builder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('usuario.nombre ILIKE'),
      { search: '%owner\\_\\%%' },
    );
    expect(builder.orderBy).toHaveBeenCalledWith('membresia.createdAt', 'DESC');
    expect(builder.addOrderBy).toHaveBeenCalledWith('membresia.id', 'DESC');
    expect(builder.skip).toHaveBeenCalledWith(10);
    expect(builder.take).toHaveBeenCalledWith(10);
    expect(result).toEqual({
      data: [
        {
          id: membresia.id,
          usuario: {
            id: usuario.id,
            nombre: usuario.nombre,
            email: usuario.email,
            activo: false,
          },
          rol: EmpresaUsuarioRol.OWNER,
          activo: true,
          createdAt,
        },
      ],
      pagination: { page: 2, limit: 10, total: 1, totalPages: 1 },
    });
    expect(JSON.stringify(result)).not.toMatch(
      /passwordHash|refreshTokenHash|sessionId|schemaName|tenant_/,
    );
  });

  it('returns only a membership from the scoped empresa', async () => {
    const builder = createBuilder({ one: membresia });
    const repository = {
      createQueryBuilder: vi.fn().mockReturnValue(builder),
    } as unknown as Repository<EmpresaUsuario>;
    const service = new EquipoService(repository, {} as DataSource);

    await expect(
      service.findOne(empresaId, membresia.id),
    ).resolves.toMatchObject({
      id: membresia.id,
      usuario: { id: usuario.id, email: usuario.email },
    });
    expect(builder.andWhere).toHaveBeenCalledWith(
      'membresia.empresaId = :empresaId',
      { empresaId },
    );
  });

  it('returns 404 for missing or cross-company memberships', async () => {
    const builder = createBuilder({ one: null });
    const repository = {
      createQueryBuilder: vi.fn().mockReturnValue(builder),
    } as unknown as Repository<EmpresaUsuario>;
    const service = new EquipoService(repository, {} as DataSource);

    await expect(
      service.findOne(empresaId, membresia.id),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
