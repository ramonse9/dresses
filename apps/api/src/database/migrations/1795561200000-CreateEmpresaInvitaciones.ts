import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmpresaInvitaciones1795561200000 implements MigrationInterface {
  name = 'CreateEmpresaInvitaciones1795561200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "public"."empresa_invitaciones" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "empresa_id" uuid NOT NULL, "email" character varying(254) NOT NULL, "rol" character varying(20) NOT NULL, "token_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "accepted_at" TIMESTAMP WITH TIME ZONE, "accepted_by_usuario_id" uuid, "revoked_at" TIMESTAMP WITH TIME ZONE, "created_by_usuario_id" uuid NOT NULL, "last_sent_at" TIMESTAMP WITH TIME ZONE, "send_count" integer NOT NULL DEFAULT 0, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_empresa_invitaciones_email_normalized" CHECK ("email" = LOWER(BTRIM("email")) AND "email" <> ''), CONSTRAINT "CHK_empresa_invitaciones_rol" CHECK ("rol" IN ('OWNER', 'EMPLOYEE')), CONSTRAINT "CHK_empresa_invitaciones_token_hash" CHECK ("token_hash" ~ '^[0-9a-f]{64}$'), CONSTRAINT "CHK_empresa_invitaciones_send_count" CHECK ("send_count" >= 0), CONSTRAINT "PK_empresa_invitaciones" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_empresa_invitaciones_empresa_created_at" ON "public"."empresa_invitaciones" ("empresa_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_empresa_invitaciones_empresa_email" ON "public"."empresa_invitaciones" ("empresa_id", "email")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_empresa_invitaciones_expires_at" ON "public"."empresa_invitaciones" ("expires_at")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_empresa_invitaciones_token_hash" ON "public"."empresa_invitaciones" ("token_hash")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_empresa_invitaciones_pendiente_empresa_email" ON "public"."empresa_invitaciones" ("empresa_id", "email") WHERE "accepted_at" IS NULL AND "revoked_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_empresa_invitaciones_pendientes" ON "public"."empresa_invitaciones" ("empresa_id", "expires_at") WHERE "accepted_at" IS NULL AND "revoked_at" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."empresa_invitaciones" ADD CONSTRAINT "FK_empresa_invitaciones_empresa" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."empresa_invitaciones" ADD CONSTRAINT "FK_empresa_invitaciones_created_by_usuario" FOREIGN KEY ("created_by_usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."empresa_invitaciones" ADD CONSTRAINT "FK_empresa_invitaciones_accepted_by_usuario" FOREIGN KEY ("accepted_by_usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."empresa_invitaciones" DROP CONSTRAINT "FK_empresa_invitaciones_accepted_by_usuario"`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."empresa_invitaciones" DROP CONSTRAINT "FK_empresa_invitaciones_created_by_usuario"`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."empresa_invitaciones" DROP CONSTRAINT "FK_empresa_invitaciones_empresa"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_empresa_invitaciones_pendientes"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_empresa_invitaciones_pendiente_empresa_email"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_empresa_invitaciones_token_hash"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_empresa_invitaciones_expires_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_empresa_invitaciones_empresa_email"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_empresa_invitaciones_empresa_created_at"`,
    );
    await queryRunner.query(`DROP TABLE "public"."empresa_invitaciones"`);
  }
}
