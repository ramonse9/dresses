import { QueryRunner } from 'typeorm';
import { quoteTenantSchemaName } from '../tenant-schema-name.js';
import { TenantMigration } from './tenant-migration.js';

export class CreateVestidos1794697200000 implements TenantMigration {
  readonly name = 'CreateVestidos1794697200000';

  async up(queryRunner: QueryRunner, schemaName: string): Promise<void> {
    const schemaIdentifier = quoteTenantSchemaName(schemaName);

    await queryRunner.query(
      `CREATE TABLE ${schemaIdentifier}."vestidos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sucursal_id" uuid NOT NULL, "codigo" character varying(50) NOT NULL, "nombre" character varying(160) NOT NULL, "descripcion" character varying(1000), "talla" character varying(30) NOT NULL, "color" character varying(80) NOT NULL, "marca" character varying(100), "precio_renta" numeric(12,2) NOT NULL, "deposito" numeric(12,2), "estado_operativo" character varying(20) NOT NULL DEFAULT 'DISPONIBLE', "activo" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_vestidos_id" PRIMARY KEY ("id"), CONSTRAINT "CHK_vestidos_estado_operativo" CHECK ("estado_operativo" IN ('DISPONIBLE', 'MANTENIMIENTO')), CONSTRAINT "CHK_vestidos_precio_renta" CHECK ("precio_renta" >= 0), CONSTRAINT "CHK_vestidos_deposito" CHECK ("deposito" IS NULL OR "deposito" >= 0), CONSTRAINT "FK_vestidos_sucursal" FOREIGN KEY ("sucursal_id") REFERENCES ${schemaIdentifier}."sucursales"("id") ON DELETE RESTRICT)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_vestidos_codigo_normalized" ON ${schemaIdentifier}."vestidos" (LOWER("codigo"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_vestidos_sucursal_id" ON ${schemaIdentifier}."vestidos" ("sucursal_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_vestidos_activo" ON ${schemaIdentifier}."vestidos" ("activo")`,
    );
  }
}
