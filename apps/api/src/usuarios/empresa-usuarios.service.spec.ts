import { Repository, SelectQueryBuilder } from 'typeorm';
import { EmpresaUsuario } from './entities/empresa-usuario.entity.js';
import { EmpresaUsuariosService } from './empresa-usuarios.service.js';

describe('EmpresaUsuariosService', () => {
  function buildQueryBuilder(result: EmpresaUsuario[] | EmpresaUsuario | null) {
    const builder = {
      innerJoinAndSelect: vi.fn(),
      innerJoin: vi.fn(),
      where: vi.fn(),
      andWhere: vi.fn(),
      orderBy: vi.fn(),
      getMany: vi.fn().mockResolvedValue(Array.isArray(result) ? result : []),
      getOne: vi.fn().mockResolvedValue(Array.isArray(result) ? null : result),
    };

    for (const method of [
      builder.innerJoinAndSelect,
      builder.innerJoin,
      builder.where,
      builder.andWhere,
      builder.orderBy,
    ]) {
      method.mockReturnValue(builder);
    }

    return {
      builder: builder as unknown as SelectQueryBuilder<EmpresaUsuario>,
      where: builder.where,
      andWhere: builder.andWhere,
      orderBy: builder.orderBy,
    };
  }

  it('lists only active memberships, empresas and users', async () => {
    const { builder, andWhere, orderBy } = buildQueryBuilder([]);
    const createQueryBuilder = vi.fn().mockReturnValue(builder);
    const repository = {
      createQueryBuilder,
    } as unknown as Repository<EmpresaUsuario>;
    const service = new EmpresaUsuariosService(repository);

    await expect(service.findActiveByUsuarioId('user-id')).resolves.toEqual([]);
    expect(createQueryBuilder).toHaveBeenCalledWith('membresia');
    expect(andWhere).toHaveBeenCalledWith('membresia.activo = true');
    expect(andWhere).toHaveBeenCalledWith('empresa.activo = true');
    expect(andWhere).toHaveBeenCalledWith('usuario.activo = true');
    expect(orderBy).toHaveBeenCalledWith('empresa.nombre', 'ASC');
  });

  it('requires an active user, membership and empresa for selection', async () => {
    const { builder, where, andWhere } = buildQueryBuilder(null);
    const repository = {
      createQueryBuilder: vi.fn().mockReturnValue(builder),
    } as unknown as Repository<EmpresaUsuario>;
    const service = new EmpresaUsuariosService(repository);

    await expect(
      service.findActiveMembership('user-id', 'empresa-id'),
    ).resolves.toBeNull();
    expect(where).toHaveBeenCalledWith('membresia.usuarioId = :usuarioId', {
      usuarioId: 'user-id',
    });
    expect(andWhere).toHaveBeenCalledWith('membresia.empresaId = :empresaId', {
      empresaId: 'empresa-id',
    });
    expect(andWhere).toHaveBeenCalledWith('membresia.activo = true');
    expect(andWhere).toHaveBeenCalledWith('empresa.activo = true');
    expect(andWhere).toHaveBeenCalledWith('usuario.activo = true');
  });
});
