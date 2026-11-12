import { Repository } from 'typeorm';
import { Usuario } from './entities/usuario.entity.js';
import { UsuariosService } from './usuarios.service.js';

describe('UsuariosService', () => {
  it('normalizes email before querying an active user', async () => {
    const usuario = {
      id: '019a6f33-82b7-7a22-971b-6a8d7c5e4f30',
      email: 'owner@example.com',
      activo: true,
    } as Usuario;
    const findOne = vi.fn().mockResolvedValue(usuario);
    const repository = { findOne } as unknown as Repository<Usuario>;
    const service = new UsuariosService(repository);

    await expect(
      service.findActiveByEmail(' Owner@Example.COM '),
    ).resolves.toBe(usuario);
    expect(findOne).toHaveBeenCalledWith({
      where: { email: 'owner@example.com', activo: true },
    });
  });

  it('queries users by UUID without selecting passwordHash explicitly', async () => {
    const findOne = vi.fn().mockResolvedValue(null);
    const repository = { findOne } as unknown as Repository<Usuario>;
    const service = new UsuariosService(repository);

    await expect(service.findById('user-id')).resolves.toBeNull();
    expect(findOne).toHaveBeenCalledWith({ where: { id: 'user-id' } });
  });

  it('selects passwordHash explicitly only for authentication', async () => {
    const getOne = vi.fn().mockResolvedValue(null);
    const where = vi.fn().mockReturnValue({ getOne });
    const addSelect = vi.fn().mockReturnValue({ where });
    const createQueryBuilder = vi.fn().mockReturnValue({ addSelect });
    const repository = {
      createQueryBuilder,
    } as unknown as Repository<Usuario>;
    const service = new UsuariosService(repository);

    await expect(
      service.findByEmailForAuthentication(' Owner@Example.COM '),
    ).resolves.toBeNull();
    expect(createQueryBuilder).toHaveBeenCalledWith('usuario');
    expect(addSelect).toHaveBeenCalledWith('usuario.passwordHash');
    expect(where).toHaveBeenCalledWith('usuario.email = :email', {
      email: 'owner@example.com',
    });
  });
});
