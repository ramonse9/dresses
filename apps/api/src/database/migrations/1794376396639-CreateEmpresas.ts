import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmpresas1794376396639 implements MigrationInterface {
  name = 'CreateEmpresas1794376396639';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "public"."empresas" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nombre" character varying(160) NOT NULL, "slug" character varying(80) NOT NULL, "schema_name" character varying(39) NOT NULL, "activo" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_empresas_schema_name" CHECK ("schema_name" ~ '^tenant_[0-9a-f]{32}$'), CONSTRAINT "PK_ce7b122b37c6499bfd6520873e1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_empresas_schema_name" ON "public"."empresas" ("schema_name")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_empresas_slug" ON "public"."empresas" ("slug")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."UQ_empresas_slug"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_empresas_schema_name"`);
    await queryRunner.query(`DROP TABLE "public"."empresas"`);
  }
}
