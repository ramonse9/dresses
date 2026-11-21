import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  ListMiembrosQueryDto,
  MiembroResponseDto,
  PaginatedMiembrosResponseDto,
} from './dto/miembro.dto.js';
import { EmpresaUsuario } from '../usuarios/entities/empresa-usuario.entity.js';

@Injectable()
export class EquipoService {
  constructor(
    @InjectRepository(EmpresaUsuario)
    private readonly membresiasRepository: Repository<EmpresaUsuario>,
  ) {}

  async findAll(
    empresaId: string,
    input: ListMiembrosQueryDto,
  ): Promise<PaginatedMiembrosResponseDto> {
    const query = this.membresiasRepository
      .createQueryBuilder('membresia')
      .innerJoinAndSelect('membresia.usuario', 'usuario')
      .where('membresia.empresaId = :empresaId', { empresaId });

    if (input.rol !== undefined) {
      query.andWhere('membresia.rol = :rol', { rol: input.rol });
    }
    if (input.activo !== undefined) {
      query.andWhere('membresia.activo = :activo', { activo: input.activo });
    }
    if (input.q !== undefined) {
      query.andWhere(
        `(usuario.nombre ILIKE :search ESCAPE '\\' OR usuario.email ILIKE :search ESCAPE '\\')`,
        { search: `%${this.escapeLikePattern(input.q)}%` },
      );
    }

    const [membresias, total] = await query
      .orderBy('membresia.createdAt', 'DESC')
      .addOrderBy('membresia.id', 'DESC')
      .skip((input.page - 1) * input.limit)
      .take(input.limit)
      .getManyAndCount();

    return {
      data: membresias.map((membresia) => this.toResponse(membresia)),
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit),
      },
    };
  }

  async findOne(empresaId: string, id: string): Promise<MiembroResponseDto> {
    const membresia = await this.membresiasRepository
      .createQueryBuilder('membresia')
      .innerJoinAndSelect('membresia.usuario', 'usuario')
      .where('membresia.id = :id', { id })
      .andWhere('membresia.empresaId = :empresaId', { empresaId })
      .getOne();

    if (!membresia) {
      throw new NotFoundException('Miembro no encontrado');
    }

    return this.toResponse(membresia);
  }

  private toResponse(membresia: EmpresaUsuario): MiembroResponseDto {
    return {
      id: membresia.id,
      usuario: {
        id: membresia.usuario.id,
        nombre: membresia.usuario.nombre,
        email: membresia.usuario.email,
        activo: membresia.usuario.activo,
      },
      rol: membresia.rol,
      activo: membresia.activo,
      createdAt: membresia.createdAt,
    };
  }

  private escapeLikePattern(value: string): string {
    return value
      .replaceAll('\\', '\\\\')
      .replaceAll('%', '\\%')
      .replaceAll('_', '\\_');
  }
}
