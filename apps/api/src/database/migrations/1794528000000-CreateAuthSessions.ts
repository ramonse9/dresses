import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuthSessions1794528000000 implements MigrationInterface {
  name = 'CreateAuthSessions1794528000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "public"."auth_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "usuario_id" uuid NOT NULL, "refresh_token_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_auth_sessions" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_auth_sessions_refresh_token_hash" ON "public"."auth_sessions" ("refresh_token_hash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_auth_sessions_usuario" ON "public"."auth_sessions" ("usuario_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_auth_sessions_expires_at" ON "public"."auth_sessions" ("expires_at")`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."auth_sessions" ADD CONSTRAINT "FK_auth_sessions_usuario" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."auth_sessions" DROP CONSTRAINT "FK_auth_sessions_usuario"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_auth_sessions_expires_at"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_auth_sessions_usuario"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_auth_sessions_refresh_token_hash"`,
    );
    await queryRunner.query(`DROP TABLE "public"."auth_sessions"`);
  }
}
