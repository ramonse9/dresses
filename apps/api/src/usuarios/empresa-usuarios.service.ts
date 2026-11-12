import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmpresaUsuario } from './entities/empresa-usuario.entity.js';

@Injectable()
export class EmpresaUsuariosService {
  constructor(
    @InjectRepository(EmpresaUsuario)
    private readonly membresiasRepository: Repository<EmpresaUsuario>,
  ) {}

  findActiveByUsuarioId(usuarioId: string): Promise<EmpresaUsuario[]> {
    return this.membresiasRepository.find({
      where: { usuarioId, activo: true },
      relations: { empresa: true },
      order: { createdAt: 'ASC' },
    });
  }

  findActiveMembership(
    usuarioId: string,
    empresaId: string,
  ): Promise<EmpresaUsuario | null> {
    return this.membresiasRepository.findOne({
      where: { usuarioId, empresaId, activo: true },
      relations: { empresa: true },
    });
  }
}
