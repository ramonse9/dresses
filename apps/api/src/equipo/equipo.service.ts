import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import type {
  ListMiembrosQueryDto,
  MiembroResponseDto,
  PaginatedMiembrosResponseDto,
} from './dto/miembro.dto.js';
import {
  EmpresaUsuario,
  EmpresaUsuarioRol,
} from '../usuarios/entities/empresa-usuario.entity.js';
import { Empresa } from '../empresas/entities/empresa.entity.js';

@Injectable()
export class EquipoService {
  constructor(
    @InjectRepository(EmpresaUsuario)
    private readonly membresiasRepository: Repository<EmpresaUsuario>,
    private readonly dataSource: DataSource,
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

  updateRol(
    empresaId: string,
    id: string,
    rol: EmpresaUsuarioRol,
  ): Promise<MiembroResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      await this.lockActiveEmpresa(manager, empresaId);
      const membresia = await this.requireLockedMembership(
        manager,
        empresaId,
        id,
      );

      if (
        membresia.activo &&
        membresia.rol === EmpresaUsuarioRol.OWNER &&
        rol !== EmpresaUsuarioRol.OWNER
      ) {
        await this.assertAnotherActiveOwner(manager, empresaId);
      }

      if (membresia.rol !== rol) {
        membresia.rol = rol;
        await manager.getRepository(EmpresaUsuario).save(membresia);
      }

      return this.toResponse(membresia);
    });
  }

  updateEstado(
    empresaId: string,
    id: string,
    activo: boolean,
  ): Promise<MiembroResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const empresa = await this.lockActiveEmpresa(manager, empresaId);
      const membresia = await this.requireLockedMembership(
        manager,
        empresaId,
        id,
      );

      if (!membresia.activo && activo) {
        if (!empresa.activo || !membresia.usuario.activo) {
          throw new ConflictException(
            'No se puede activar una membresía con usuario o empresa inactivos',
          );
        }
      }

      if (
        membresia.activo &&
        !activo &&
        membresia.rol === EmpresaUsuarioRol.OWNER
      ) {
        await this.assertAnotherActiveOwner(manager, empresaId);
      }

      if (membresia.activo !== activo) {
        membresia.activo = activo;
        await manager.getRepository(EmpresaUsuario).save(membresia);
      }

      return this.toResponse(membresia);
    });
  }

  private async lockActiveEmpresa(
    manager: EntityManager,
    empresaId: string,
  ): Promise<Empresa> {
    const empresa = await manager
      .getRepository(Empresa)
      .createQueryBuilder('empresa')
      .where('empresa.id = :empresaId', { empresaId })
      .setLock('pessimistic_write')
      .getOne();

    if (!empresa) {
      throw new NotFoundException('Empresa no encontrada');
    }
    if (!empresa.activo) {
      throw new ConflictException('La empresa está inactiva');
    }

    return empresa;
  }

  private async requireLockedMembership(
    manager: EntityManager,
    empresaId: string,
    id: string,
  ): Promise<EmpresaUsuario> {
    const membresia = await manager
      .getRepository(EmpresaUsuario)
      .createQueryBuilder('membresia')
      .innerJoinAndSelect('membresia.usuario', 'usuario')
      .where('membresia.id = :id', { id })
      .andWhere('membresia.empresaId = :empresaId', { empresaId })
      .setLock('pessimistic_write', undefined, ['membresia'])
      .getOne();

    if (!membresia) {
      throw new NotFoundException('Miembro no encontrado');
    }

    return membresia;
  }

  private async assertAnotherActiveOwner(
    manager: EntityManager,
    empresaId: string,
  ): Promise<void> {
    const activeOwners = await manager
      .getRepository(EmpresaUsuario)
      .createQueryBuilder('membresia')
      .innerJoin('membresia.usuario', 'usuario')
      .where('membresia.empresaId = :empresaId', { empresaId })
      .andWhere('membresia.rol = :rol', {
        rol: EmpresaUsuarioRol.OWNER,
      })
      .andWhere('membresia.activo = true')
      .andWhere('usuario.activo = true')
      .getCount();

    if (activeOwners <= 1) {
      throw new ConflictException(
        'La empresa debe conservar al menos un OWNER activo',
      );
    }
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
