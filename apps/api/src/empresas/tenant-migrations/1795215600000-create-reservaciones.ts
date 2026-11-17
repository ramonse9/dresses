import { QueryRunner } from 'typeorm';
import { quoteTenantSchemaName } from '../tenant-schema-name.js';
import { TenantMigration } from './tenant-migration.js';

export class CreateReservaciones1795215600000 implements TenantMigration {
  readonly name = 'CreateReservaciones1795215600000';

  async up(queryRunner: QueryRunner, schemaName: string): Promise<void> {
    const schemaIdentifier = quoteTenantSchemaName(schemaName);

    await queryRunner.query(
      `CREATE TABLE ${schemaIdentifier}."reservaciones" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "cliente_id" uuid NOT NULL, "sucursal_id" uuid NOT NULL, "fecha_inicio" TIMESTAMP WITH TIME ZONE NOT NULL, "fecha_fin" TIMESTAMP WITH TIME ZONE NOT NULL, "estado" character varying(20) NOT NULL DEFAULT 'BORRADOR', "notas" character varying(2000), "importe_renta" numeric(12,2) NOT NULL, "deposito_requerido" numeric(12,2) NOT NULL, "confirmada_at" TIMESTAMP WITH TIME ZONE, "entregada_at" TIMESTAMP WITH TIME ZONE, "devuelta_at" TIMESTAMP WITH TIME ZONE, "cancelada_at" TIMESTAMP WITH TIME ZONE, "motivo_cancelacion" character varying(1000), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_reservaciones_id" PRIMARY KEY ("id"), CONSTRAINT "CHK_reservaciones_fechas" CHECK ("fecha_fin" > "fecha_inicio"), CONSTRAINT "CHK_reservaciones_estado" CHECK ("estado" IN ('BORRADOR', 'CONFIRMADA', 'ENTREGADA', 'DEVUELTA', 'CANCELADA')), CONSTRAINT "CHK_reservaciones_importe_renta" CHECK ("importe_renta" >= 0), CONSTRAINT "CHK_reservaciones_deposito_requerido" CHECK ("deposito_requerido" >= 0), CONSTRAINT "FK_reservaciones_cliente" FOREIGN KEY ("cliente_id") REFERENCES ${schemaIdentifier}."clientes"("id") ON DELETE RESTRICT, CONSTRAINT "FK_reservaciones_sucursal" FOREIGN KEY ("sucursal_id") REFERENCES ${schemaIdentifier}."sucursales"("id") ON DELETE RESTRICT)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reservaciones_cliente_created_at" ON ${schemaIdentifier}."reservaciones" ("cliente_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reservaciones_sucursal_estado_fechas" ON ${schemaIdentifier}."reservaciones" ("sucursal_id", "estado", "fecha_inicio", "fecha_fin")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reservaciones_estado_fechas" ON ${schemaIdentifier}."reservaciones" ("estado", "fecha_inicio", "fecha_fin")`,
    );
    await queryRunner.query(
      `CREATE TABLE ${schemaIdentifier}."reservacion_vestidos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "reservacion_id" uuid NOT NULL, "vestido_id" uuid NOT NULL, "precio_renta" numeric(12,2) NOT NULL, "deposito" numeric(12,2) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_reservacion_vestidos_id" PRIMARY KEY ("id"), CONSTRAINT "UQ_reservacion_vestidos_reservacion_vestido" UNIQUE ("reservacion_id", "vestido_id"), CONSTRAINT "CHK_reservacion_vestidos_precio_renta" CHECK ("precio_renta" >= 0), CONSTRAINT "CHK_reservacion_vestidos_deposito" CHECK ("deposito" >= 0), CONSTRAINT "FK_reservacion_vestidos_reservacion" FOREIGN KEY ("reservacion_id") REFERENCES ${schemaIdentifier}."reservaciones"("id") ON DELETE CASCADE, CONSTRAINT "FK_reservacion_vestidos_vestido" FOREIGN KEY ("vestido_id") REFERENCES ${schemaIdentifier}."vestidos"("id") ON DELETE RESTRICT)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reservacion_vestidos_reservacion_id" ON ${schemaIdentifier}."reservacion_vestidos" ("reservacion_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reservacion_vestidos_vestido_id" ON ${schemaIdentifier}."reservacion_vestidos" ("vestido_id")`,
    );
  }
}
