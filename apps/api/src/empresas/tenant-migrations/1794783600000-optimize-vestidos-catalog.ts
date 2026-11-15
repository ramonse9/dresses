import { QueryRunner } from 'typeorm';
import { quoteTenantSchemaName } from '../tenant-schema-name.js';
import { TenantMigration } from './tenant-migration.js';

export class OptimizeVestidosCatalog1794783600000 implements TenantMigration {
  readonly name = 'OptimizeVestidosCatalog1794783600000';

  async up(queryRunner: QueryRunner, schemaName: string): Promise<void> {
    const schemaIdentifier = quoteTenantSchemaName(schemaName);

    await queryRunner.query(
      `DROP INDEX ${schemaIdentifier}."IDX_vestidos_sucursal_id"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_vestidos_sucursal_id" ON ${schemaIdentifier}."vestidos" ("sucursal_id", "created_at", "id")`,
    );
    await queryRunner.query(
      `DROP INDEX ${schemaIdentifier}."IDX_vestidos_activo"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_vestidos_activo" ON ${schemaIdentifier}."vestidos" ("activo", "created_at", "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_vestidos_estado_operativo" ON ${schemaIdentifier}."vestidos" ("estado_operativo", "created_at", "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_vestidos_catalog_order" ON ${schemaIdentifier}."vestidos" ("created_at", "id")`,
    );
  }
}
