import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { quoteTenantSchemaName } from '../empresas/tenant-schema-name.js';

@Injectable()
export class TenantContextService {
  constructor(private readonly dataSource: DataSource) {}

  async run<T>(
    schemaName: string,
    operation: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();
      await queryRunner.query(
        `SET LOCAL search_path TO ${quoteTenantSchemaName(schemaName)}, public`,
      );

      const result = await operation(queryRunner.manager);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }

      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
