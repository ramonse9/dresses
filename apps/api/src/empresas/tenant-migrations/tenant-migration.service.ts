import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { quoteTenantSchemaName } from '../tenant-schema-name.js';
import { InitializeTenant1794377000000 } from './1794377000000-initialize-tenant.js';
import { CreateSucursales1794378000000 } from './1794378000000-create-sucursales.js';
import { TenantMigration } from './tenant-migration.js';

const tenantMigrations: readonly TenantMigration[] = [
  new InitializeTenant1794377000000(),
  new CreateSucursales1794378000000(),
];

@Injectable()
export class TenantMigrationService {
  constructor(private readonly dataSource: DataSource) {}

  async ensureMigrations(schemaName: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();
      await queryRunner.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        schemaName,
      ]);
      await this.runMigrations(queryRunner, schemaName);
      await queryRunner.commitTransaction();
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }

      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async runMigrations(
    queryRunner: QueryRunner,
    schemaName: string,
  ): Promise<void> {
    const schemaIdentifier = quoteTenantSchemaName(schemaName);

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS ${schemaIdentifier}."tenant_migrations" ("name" character varying(255) PRIMARY KEY, "executed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now())`,
    );

    const executedMigrations = (await queryRunner.query(
      `SELECT "name" FROM ${schemaIdentifier}."tenant_migrations"`,
    )) as Array<{ name: string }>;
    const executedNames = new Set(
      executedMigrations.map((migration) => migration.name),
    );

    for (const migration of tenantMigrations) {
      if (executedNames.has(migration.name)) {
        continue;
      }

      await migration.up(queryRunner, schemaName);
      await queryRunner.query(
        `INSERT INTO ${schemaIdentifier}."tenant_migrations" ("name") VALUES ($1)`,
        [migration.name],
      );
    }
  }
}
