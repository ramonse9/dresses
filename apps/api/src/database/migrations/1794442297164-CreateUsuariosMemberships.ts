import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsuariosMemberships1794442297164 implements MigrationInterface {
  name = 'CreateUsuariosMemberships1794442297164';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "public"."usuarios" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(254) NOT NULL, "password_hash" character varying(255) NOT NULL, "nombre" character varying(160) NOT NULL, "activo" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_usuarios_email_lowercase" CHECK ("email" = LOWER("email")), CONSTRAINT "PK_d7281c63c176e152e4c531594a8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_usuarios_email" ON "public"."usuarios" ("email")`,
    );
    await queryRunner.query(
      `CREATE TABLE "public"."empresa_usuarios" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "usuario_id" uuid NOT NULL, "empresa_id" uuid NOT NULL, "rol" character varying(20) NOT NULL, "activo" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_empresa_usuarios_rol" CHECK ("rol" IN ('OWNER', 'EMPLOYEE')), CONSTRAINT "PK_f8d201f9ede18b4a33760967d79" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_empresa_usuarios_empresa" ON "public"."empresa_usuarios" ("empresa_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_empresa_usuarios_usuario" ON "public"."empresa_usuarios" ("usuario_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_empresa_usuarios_usuario_empresa" ON "public"."empresa_usuarios" ("usuario_id", "empresa_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."empresa_usuarios" ADD CONSTRAINT "FK_a05d997c37d1a8b70200a5bf4cd" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."empresa_usuarios" ADD CONSTRAINT "FK_d892a5f8edf2d3ff24ec2219368" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."empresa_usuarios" DROP CONSTRAINT "FK_d892a5f8edf2d3ff24ec2219368"`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."empresa_usuarios" DROP CONSTRAINT "FK_a05d997c37d1a8b70200a5bf4cd"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_empresa_usuarios_usuario_empresa"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_empresa_usuarios_usuario"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_empresa_usuarios_empresa"`,
    );
    await queryRunner.query(`DROP TABLE "public"."empresa_usuarios"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_usuarios_email"`);
    await queryRunner.query(`DROP TABLE "public"."usuarios"`);
  }
}
