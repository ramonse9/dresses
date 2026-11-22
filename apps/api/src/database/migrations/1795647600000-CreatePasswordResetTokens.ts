import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePasswordResetTokens1795647600000 implements MigrationInterface {
  name = 'CreatePasswordResetTokens1795647600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."usuarios" ADD "password_changed_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `CREATE TABLE "public"."password_reset_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "usuario_id" uuid NOT NULL, "token_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, "revoked_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_password_reset_tokens_token_hash" CHECK ("token_hash" ~ '^[0-9a-f]{64}$'), CONSTRAINT "PK_password_reset_tokens" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_password_reset_tokens_usuario_created_at" ON "public"."password_reset_tokens" ("usuario_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_password_reset_tokens_expires_at" ON "public"."password_reset_tokens" ("expires_at")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_password_reset_tokens_token_hash" ON "public"."password_reset_tokens" ("token_hash")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_password_reset_tokens_pending_usuario" ON "public"."password_reset_tokens" ("usuario_id") WHERE "used_at" IS NULL AND "revoked_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_password_reset_tokens_pending" ON "public"."password_reset_tokens" ("usuario_id", "expires_at") WHERE "used_at" IS NULL AND "revoked_at" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."password_reset_tokens" ADD CONSTRAINT "FK_password_reset_tokens_usuario" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."password_reset_tokens" DROP CONSTRAINT "FK_password_reset_tokens_usuario"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_password_reset_tokens_pending"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_password_reset_tokens_pending_usuario"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_password_reset_tokens_token_hash"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_password_reset_tokens_expires_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_password_reset_tokens_usuario_created_at"`,
    );
    await queryRunner.query(`DROP TABLE "public"."password_reset_tokens"`);
    await queryRunner.query(
      `ALTER TABLE "public"."usuarios" DROP COLUMN "password_changed_at"`,
    );
  }
}
