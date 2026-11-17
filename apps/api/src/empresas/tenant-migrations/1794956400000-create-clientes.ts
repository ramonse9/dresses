import { QueryRunner } from 'typeorm';
import { quoteTenantSchemaName } from '../tenant-schema-name.js';
import { TenantMigration } from './tenant-migration.js';

export class CreateClientes1794956400000 implements TenantMigration {
  readonly name = 'CreateClientes1794956400000';

  async up(queryRunner: QueryRunner, schemaName: string): Promise<void> {
    const schemaIdentifier = quoteTenantSchemaName(schemaName);

    await queryRunner.query(
      `CREATE TABLE ${schemaIdentifier}."clientes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nombre" character varying(160) NOT NULL, "telefono" character varying(40), "email" character varying(254), "direccion" character varying(255), "notas" character varying(2000), "activo" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_clientes_id" PRIMARY KEY ("id"), CONSTRAINT "CHK_clientes_nombre_normalized" CHECK ("nombre" = BTRIM("nombre") AND LENGTH("nombre") > 0), CONSTRAINT "CHK_clientes_contacto_requerido" CHECK ("telefono" IS NOT NULL OR "email" IS NOT NULL), CONSTRAINT "CHK_clientes_telefono_normalized" CHECK ("telefono" IS NULL OR ("telefono" = BTRIM("telefono") AND LENGTH("telefono") > 0)), CONSTRAINT "CHK_clientes_email_normalized" CHECK ("email" IS NULL OR ("email" = LOWER(BTRIM("email")) AND LENGTH("email") > 0)), CONSTRAINT "CHK_clientes_direccion_normalized" CHECK ("direccion" IS NULL OR ("direccion" = BTRIM("direccion") AND LENGTH("direccion") > 0)), CONSTRAINT "CHK_clientes_notas_normalized" CHECK ("notas" IS NULL OR ("notas" = BTRIM("notas") AND LENGTH("notas") > 0)))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_clientes_activo_created_at" ON ${schemaIdentifier}."clientes" ("activo", "created_at", "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_clientes_nombre_normalized" ON ${schemaIdentifier}."clientes" (LOWER("nombre"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_clientes_email_normalized" ON ${schemaIdentifier}."clientes" (LOWER("email")) WHERE "email" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_clientes_telefono" ON ${schemaIdentifier}."clientes" ("telefono") WHERE "telefono" IS NOT NULL`,
    );
  }
}
