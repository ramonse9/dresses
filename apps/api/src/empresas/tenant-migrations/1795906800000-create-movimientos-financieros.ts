import { QueryRunner } from 'typeorm';
import { quoteTenantSchemaName } from '../tenant-schema-name.js';
import { TenantMigration } from './tenant-migration.js';

export class CreateMovimientosFinancieros1795906800000 implements TenantMigration {
  readonly name = 'CreateMovimientosFinancieros1795906800000';

  async up(queryRunner: QueryRunner, schemaName: string): Promise<void> {
    const schemaIdentifier = quoteTenantSchemaName(schemaName);

    await queryRunner.query(
      `CREATE TABLE ${schemaIdentifier}."movimientos_financieros" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "reservacion_id" uuid NOT NULL, "sucursal_id" uuid NOT NULL, "tipo" character varying(30) NOT NULL, "monto" numeric(12,2) NOT NULL, "metodo_pago" character varying(20) NOT NULL, "referencia" character varying(120), "notas" character varying(500), "movimiento_origen_id" uuid, "idempotency_key" uuid NOT NULL, "registrado_por_usuario_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_movimientos_financieros_id" PRIMARY KEY ("id"), CONSTRAINT "CHK_movimientos_financieros_monto_positivo" CHECK ("monto" > 0), CONSTRAINT "CHK_movimientos_financieros_tipo" CHECK ("tipo" IN ('PAGO_RENTA', 'PAGO_DEPOSITO', 'REEMBOLSO_RENTA', 'DEVOLUCION_DEPOSITO', 'REVERSO')), CONSTRAINT "CHK_movimientos_financieros_metodo_pago" CHECK ("metodo_pago" IN ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'OTRO')), CONSTRAINT "CHK_movimientos_financieros_origen_por_tipo" CHECK (("tipo" IN ('PAGO_RENTA', 'PAGO_DEPOSITO') AND "movimiento_origen_id" IS NULL) OR ("tipo" IN ('REEMBOLSO_RENTA', 'DEVOLUCION_DEPOSITO', 'REVERSO') AND "movimiento_origen_id" IS NOT NULL)), CONSTRAINT "CHK_movimientos_financieros_referencia_normalized" CHECK ("referencia" IS NULL OR ("referencia" = BTRIM("referencia") AND LENGTH("referencia") > 0)), CONSTRAINT "CHK_movimientos_financieros_notas_normalized" CHECK ("notas" IS NULL OR ("notas" = BTRIM("notas") AND LENGTH("notas") > 0)), CONSTRAINT "FK_movimientos_financieros_reservacion" FOREIGN KEY ("reservacion_id") REFERENCES ${schemaIdentifier}."reservaciones"("id") ON DELETE RESTRICT, CONSTRAINT "FK_movimientos_financieros_sucursal" FOREIGN KEY ("sucursal_id") REFERENCES ${schemaIdentifier}."sucursales"("id") ON DELETE RESTRICT, CONSTRAINT "FK_movimientos_financieros_origen" FOREIGN KEY ("movimiento_origen_id") REFERENCES ${schemaIdentifier}."movimientos_financieros"("id") ON DELETE RESTRICT)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_movimientos_financieros_reservacion_created_at_id" ON ${schemaIdentifier}."movimientos_financieros" ("reservacion_id", "created_at" DESC, "id" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_movimientos_financieros_sucursal_created_at_id" ON ${schemaIdentifier}."movimientos_financieros" ("sucursal_id", "created_at" DESC, "id" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_movimientos_financieros_tipo_created_at" ON ${schemaIdentifier}."movimientos_financieros" ("tipo", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_movimientos_financieros_origen_id" ON ${schemaIdentifier}."movimientos_financieros" ("movimiento_origen_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_movimientos_financieros_registrado_por_created_at" ON ${schemaIdentifier}."movimientos_financieros" ("registrado_por_usuario_id", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_movimientos_financieros_idempotency_key" ON ${schemaIdentifier}."movimientos_financieros" ("idempotency_key")`,
    );
    await queryRunner.query(
      `CREATE OR REPLACE FUNCTION ${schemaIdentifier}."prevent_movimientos_financieros_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'movimientos_financieros are append-only' USING ERRCODE = '55000'; END; $$`,
    );
    await queryRunner.query(
      `CREATE TRIGGER "TRG_movimientos_financieros_append_only" BEFORE UPDATE OR DELETE ON ${schemaIdentifier}."movimientos_financieros" FOR EACH ROW EXECUTE FUNCTION ${schemaIdentifier}."prevent_movimientos_financieros_mutation"()`,
    );
  }
}
