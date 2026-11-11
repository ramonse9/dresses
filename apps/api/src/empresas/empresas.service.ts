import {
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { CreateEmpresaDto } from './dto/create-empresa.dto.js';
import { Empresa } from './entities/empresa.entity.js';
import {
  quoteTenantSchemaName,
  tenantSchemaNameFromEmpresaId,
} from './tenant-schema-name.js';
import { TenantMigrationService } from './tenant-migrations/tenant-migration.service.js';

@Injectable()
export class EmpresasService {
  constructor(
    @InjectRepository(Empresa)
    private readonly empresasRepository: Repository<Empresa>,
    private readonly dataSource: DataSource,
    private readonly tenantMigrationService: TenantMigrationService,
  ) {}

  async create(input: CreateEmpresaDto): Promise<Empresa> {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      const transactionRepository = queryRunner.manager.getRepository(Empresa);
      const existingEmpresa = await transactionRepository.findOne({
        where: { slug: input.slug },
      });

      if (existingEmpresa) {
        throw new ConflictException('Ya existe una empresa con ese slug');
      }

      const id = randomUUID();
      const schemaName = tenantSchemaNameFromEmpresaId(id);
      const empresa = transactionRepository.create({
        id,
        nombre: input.nombre,
        slug: input.slug,
        schemaName,
        activo: true,
      });

      await transactionRepository.save(empresa);
      await queryRunner.query(
        `CREATE SCHEMA ${quoteTenantSchemaName(schemaName)}`,
      );
      await this.tenantMigrationService.runMigrations(queryRunner, schemaName);
      await queryRunner.commitTransaction();

      return empresa;
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }

      if (error instanceof HttpException) {
        throw error;
      }

      if (this.isSlugUniqueViolation(error)) {
        throw new ConflictException('Ya existe una empresa con ese slug');
      }

      throw new InternalServerErrorException(
        'No fue posible crear la empresa y su tenant',
      );
    } finally {
      await queryRunner.release();
    }
  }

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

  findActiveById(id: string): Promise<Empresa | null> {
    return this.empresasRepository.findOne({
      where: { id, activo: true },
    });
  }

  private isSlugUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = error.driverError as {
      code?: string;
      constraint?: string;
    };

    return (
      driverError.code === '23505' &&
      driverError.constraint === 'UQ_empresas_slug'
    );
  }
}
