import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { normalizeEmail } from './email.js';
import { Usuario } from './entities/usuario.entity.js';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuariosRepository: Repository<Usuario>,
  ) {}

  findById(id: string): Promise<Usuario | null> {
    return this.usuariosRepository.findOne({ where: { id } });
  }

  findActiveByEmail(email: string): Promise<Usuario | null> {
    return this.usuariosRepository.findOne({
      where: { email: normalizeEmail(email), activo: true },
    });
  }
}
