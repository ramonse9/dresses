import { Injectable } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { quoteTenantSchemaName } from '../tenant-schema-name.js';
import { InitializeTenant1794377000000 } from './1794377000000-initialize-tenant.js';
import { TenantMigration } from './tenant-migration.js';

const initialMigrations: readonly TenantMigration[] = [
  new InitializeTenant1794377000000(),
];

@Injectable()
export class TenantMigrationService {
  async runInitialMigrations(
    queryRunner: QueryRunner,
    schemaName: string,
  ): Promise<void> {
    const schemaIdentifier = quoteTenantSchemaName(schemaName);

    await queryRunner.query(
      `CREATE TABLE ${schemaIdentifier}."tenant_migrations" ("name" character varying(255) PRIMARY KEY, "executed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now())`,
    );

    const executedMigrations = (await queryRunner.query(
      `SELECT "name" FROM ${schemaIdentifier}."tenant_migrations"`,
    )) as Array<{ name: string }>;
    const executedNames = new Set(
      executedMigrations.map((migration) => migration.name),
    );

    for (const migration of initialMigrations) {
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
