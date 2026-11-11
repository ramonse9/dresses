import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Empresa } from './entities/empresa.entity.js';

@Injectable()
export class EmpresasService {
  constructor(
    @InjectRepository(Empresa)
    private readonly empresasRepository: Repository<Empresa>,
  ) {}

  findAll(): Promise<Empresa[]> {
    return this.empresasRepository.find({
      order: { nombre: 'ASC' },
    });
  }

  findActiveBySlug(slug: string): Promise<Empresa | null> {
    return this.empresasRepository.findOne({
      where: { slug, activo: true },
    });
  }
}
