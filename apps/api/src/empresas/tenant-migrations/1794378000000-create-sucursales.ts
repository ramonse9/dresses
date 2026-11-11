import { QueryRunner } from 'typeorm';
import { quoteTenantSchemaName } from '../tenant-schema-name.js';
import { TenantMigration } from './tenant-migration.js';

export class CreateSucursales1794378000000 implements TenantMigration {
  readonly name = 'CreateSucursales1794378000000';

  async up(queryRunner: QueryRunner, schemaName: string): Promise<void> {
    const schemaIdentifier = quoteTenantSchemaName(schemaName);

    await queryRunner.query(
      `CREATE TABLE ${schemaIdentifier}."sucursales" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nombre" character varying(160) NOT NULL, "direccion" character varying(255), "telefono" character varying(40), "activo" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_sucursales_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_sucursales_nombre_normalized" ON ${schemaIdentifier}."sucursales" (LOWER("nombre"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sucursales_activo" ON ${schemaIdentifier}."sucursales" ("activo")`,
    );
  }
}
