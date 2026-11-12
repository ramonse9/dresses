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
    return this.membresiasRepository
      .createQueryBuilder('membresia')
      .innerJoinAndSelect('membresia.empresa', 'empresa')
      .innerJoin('membresia.usuario', 'usuario')
      .where('membresia.usuarioId = :usuarioId', { usuarioId })
      .andWhere('membresia.activo = true')
      .andWhere('empresa.activo = true')
      .andWhere('usuario.activo = true')
      .orderBy('empresa.nombre', 'ASC')
      .getMany();
  }

  findActiveMembership(
    usuarioId: string,
    empresaId: string,
  ): Promise<EmpresaUsuario | null> {
    return this.membresiasRepository
      .createQueryBuilder('membresia')
      .innerJoinAndSelect('membresia.empresa', 'empresa')
      .innerJoin('membresia.usuario', 'usuario')
      .where('membresia.usuarioId = :usuarioId', { usuarioId })
      .andWhere('membresia.empresaId = :empresaId', { empresaId })
      .andWhere('membresia.activo = true')
      .andWhere('empresa.activo = true')
      .andWhere('usuario.activo = true')
      .getOne();
  }
}
