import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuthSessionMetadata1795734000000 implements MigrationInterface {
  name = 'AddAuthSessionMetadata1795734000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."auth_sessions" ADD "ip_address" inet`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."auth_sessions" ADD "user_agent" character varying(512)`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."auth_sessions" ADD "last_seen_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `UPDATE "public"."auth_sessions" SET "last_seen_at" = COALESCE("updated_at", "created_at", now())`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."auth_sessions" ALTER COLUMN "last_seen_at" SET DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."auth_sessions" ALTER COLUMN "last_seen_at" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."auth_sessions" ADD "revoked_by_usuario_id" uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_auth_sessions_usuario_revoked_at" ON "public"."auth_sessions" ("usuario_id", "revoked_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_auth_sessions_usuario_last_seen_at" ON "public"."auth_sessions" ("usuario_id", "last_seen_at")`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."auth_sessions" ADD CONSTRAINT "FK_auth_sessions_revoked_by_usuario" FOREIGN KEY ("revoked_by_usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."auth_sessions" DROP CONSTRAINT "FK_auth_sessions_revoked_by_usuario"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_auth_sessions_usuario_last_seen_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_auth_sessions_usuario_revoked_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."auth_sessions" DROP COLUMN "revoked_by_usuario_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."auth_sessions" DROP COLUMN "last_seen_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."auth_sessions" DROP COLUMN "user_agent"`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."auth_sessions" DROP COLUMN "ip_address"`,
    );
  }
}
