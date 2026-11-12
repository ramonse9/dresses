import { Repository } from 'typeorm';
import { EmpresaUsuario } from './entities/empresa-usuario.entity.js';
import { EmpresaUsuariosService } from './empresa-usuarios.service.js';

describe('EmpresaUsuariosService', () => {
  it('lists active memberships with their empresa', async () => {
    const find = vi.fn().mockResolvedValue([]);
    const repository = { find } as unknown as Repository<EmpresaUsuario>;
    const service = new EmpresaUsuariosService(repository);

    await expect(service.findActiveByUsuarioId('user-id')).resolves.toEqual([]);
    expect(find).toHaveBeenCalledWith({
      where: { usuarioId: 'user-id', activo: true },
      relations: { empresa: true },
      order: { createdAt: 'ASC' },
    });
  });

  it('queries an active membership by user and empresa', async () => {
    const findOne = vi.fn().mockResolvedValue(null);
    const repository = { findOne } as unknown as Repository<EmpresaUsuario>;
    const service = new EmpresaUsuariosService(repository);

    await expect(
      service.findActiveMembership('user-id', 'empresa-id'),
    ).resolves.toBeNull();
    expect(findOne).toHaveBeenCalledWith({
      where: {
        usuarioId: 'user-id',
        empresaId: 'empresa-id',
        activo: true,
      },
      relations: { empresa: true },
    });
  });
});
