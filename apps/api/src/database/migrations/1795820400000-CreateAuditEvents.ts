import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditEvents1795820400000 implements MigrationInterface {
  name = 'CreateAuditEvents1795820400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "public"."audit_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "empresa_id" uuid, "actor_usuario_id" uuid, "session_id" uuid, "action" character varying(120) NOT NULL, "resource_type" character varying(80) NOT NULL, "resource_id" uuid, "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, "ip_address" inet, "user_agent" character varying(512), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_audit_events_action_not_empty" CHECK (BTRIM("action") <> ''), CONSTRAINT "CHK_audit_events_resource_type_not_empty" CHECK (BTRIM("resource_type") <> ''), CONSTRAINT "CHK_audit_events_metadata_object" CHECK (jsonb_typeof("metadata") = 'object'), CONSTRAINT "PK_audit_events" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_events_empresa_created_at_id" ON "public"."audit_events" ("empresa_id", "created_at", "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_events_actor_created_at" ON "public"."audit_events" ("actor_usuario_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_events_resource_created_at" ON "public"."audit_events" ("resource_type", "resource_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_events_action_created_at" ON "public"."audit_events" ("action", "created_at")`,
    );
    await queryRunner.query(
      `CREATE FUNCTION "public"."prevent_audit_events_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit_events are immutable' USING ERRCODE = '55000'; END; $$`,
    );
    await queryRunner.query(
      `CREATE TRIGGER "TRG_audit_events_immutable" BEFORE UPDATE OR DELETE ON "public"."audit_events" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_audit_events_mutation"()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER "TRG_audit_events_immutable" ON "public"."audit_events"`,
    );
    await queryRunner.query(
      `DROP FUNCTION "public"."prevent_audit_events_mutation"()`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_audit_events_action_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_audit_events_resource_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_audit_events_actor_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_audit_events_empresa_created_at_id"`,
    );
    await queryRunner.query(`DROP TABLE "public"."audit_events"`);
  }
}
