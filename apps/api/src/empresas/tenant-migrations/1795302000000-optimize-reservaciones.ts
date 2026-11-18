import { QueryRunner } from 'typeorm';
import { quoteTenantSchemaName } from '../tenant-schema-name.js';
import { TenantMigration } from './tenant-migration.js';

export class OptimizeReservaciones1795302000000 implements TenantMigration {
  readonly name = 'OptimizeReservaciones1795302000000';

  async up(queryRunner: QueryRunner, schemaName: string): Promise<void> {
    const schemaIdentifier = quoteTenantSchemaName(schemaName);

    await queryRunner.query(
      `DROP INDEX ${schemaIdentifier}."IDX_reservaciones_cliente_created_at"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reservaciones_cliente_created_at" ON ${schemaIdentifier}."reservaciones" ("cliente_id", "created_at" DESC, "id" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reservaciones_sucursal_created_at_id" ON ${schemaIdentifier}."reservaciones" ("sucursal_id", "created_at" DESC, "id" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reservaciones_created_at_id" ON ${schemaIdentifier}."reservaciones" ("created_at" DESC, "id" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reservaciones_fechas" ON ${schemaIdentifier}."reservaciones" ("fecha_inicio", "fecha_fin")`,
    );
    await queryRunner.query(
      `DROP INDEX ${schemaIdentifier}."IDX_reservacion_vestidos_vestido_id"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reservacion_vestidos_vestido_id" ON ${schemaIdentifier}."reservacion_vestidos" ("vestido_id", "reservacion_id")`,
    );
  }
}
