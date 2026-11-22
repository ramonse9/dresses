import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { DataSource, QueryFailedError } from 'typeorm';
import { CreateEmpresas1794376396639 } from '../src/database/migrations/1794376396639-CreateEmpresas.js';
import { CreateUsuariosMemberships1794442297164 } from '../src/database/migrations/1794442297164-CreateUsuariosMemberships.js';
import { CreateAuthSessions1794528000000 } from '../src/database/migrations/1794528000000-CreateAuthSessions.js';
import { CreateEmpresaInvitaciones1795561200000 } from '../src/database/migrations/1795561200000-CreateEmpresaInvitaciones.js';
import { CreatePasswordResetTokens1795647600000 } from '../src/database/migrations/1795647600000-CreatePasswordResetTokens.js';

describe('PostgreSQL password reset tokens migration', () => {
  let adminDataSource: DataSource;
  let temporaryDataSource: DataSource;
  const databaseName = createTemporaryDatabaseName();

  beforeAll(async () => {
    const connection = postgresConnection();
    adminDataSource = new DataSource({ ...connection, database: 'postgres' });
    await adminDataSource.initialize();
    await adminDataSource.query(`CREATE DATABASE "${databaseName}"`);

    temporaryDataSource = new DataSource({
      ...connection,
      database: databaseName,
      migrationsTableName: 'typeorm_migrations',
      migrations: [
        CreateEmpresas1794376396639,
        CreateUsuariosMemberships1794442297164,
        CreateAuthSessions1794528000000,
        CreateEmpresaInvitaciones1795561200000,
        CreatePasswordResetTokens1795647600000,
      ],
      synchronize: false,
      migrationsRun: false,
    });
    await temporaryDataSource.initialize();
    await temporaryDataSource.query(
      'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"',
    );
  });

  afterAll(async () => {
    if (temporaryDataSource?.isInitialized) {
      await temporaryDataSource.destroy();
    }
    if (adminDataSource?.isInitialized) {
      await adminDataSource.query(
        `DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`,
      );
      await adminDataSource.destroy();
    }
  });

  it('migrates a new database and supports down/up on an existing database', async () => {
    const applied = await temporaryDataSource.runMigrations();

    expect(applied.at(-1)?.name).toBe('CreatePasswordResetTokens1795647600000');
    await expectStructures(true);

    await temporaryDataSource.undoLastMigration();
    await expectStructures(false);

    const reapplied = await temporaryDataSource.runMigrations();
    expect(reapplied.map(({ name }) => name)).toEqual([
      'CreatePasswordResetTokens1795647600000',
    ]);
    await expectStructures(true);
  });

  it('enforces hash validity, uniqueness and one unrevoked pending token per user', async () => {
    const usuarioId = await insertUsuario('reset-owner@example.com');
    const pendingId = randomUUID();

    await insertToken({
      id: pendingId,
      usuarioId,
      tokenHash: 'a'.repeat(64),
      expiresAt: new Date(Date.now() - 60_000),
    });

    await expectConstraintFailure(
      insertToken({ usuarioId, tokenHash: 'b'.repeat(64) }),
      '23505',
      'UQ_password_reset_tokens_pending_usuario',
    );

    const otherUsuarioId = await insertUsuario('other-reset@example.com');
    await expectConstraintFailure(
      insertToken({ usuarioId: otherUsuarioId, tokenHash: 'a'.repeat(64) }),
      '23505',
      'UQ_password_reset_tokens_token_hash',
    );
    await expectConstraintFailure(
      insertToken({ usuarioId: otherUsuarioId, tokenHash: 'invalid-hash' }),
      '23514',
      'CHK_password_reset_tokens_token_hash',
    );

    await temporaryDataSource.query(
      `UPDATE "public"."password_reset_tokens" SET "revoked_at" = now() WHERE "id" = $1`,
      [pendingId],
    );
    await expect(
      insertToken({ usuarioId, tokenHash: 'c'.repeat(64) }),
    ).resolves.toBeDefined();
  });

  it('creates the required public indexes and cascading user relation', async () => {
    const indexes = (await temporaryDataSource.query(
      `SELECT indexname AS "name", indexdef AS "definition" FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'password_reset_tokens' ORDER BY indexname`,
    )) as Array<{ name: string; definition: string }>;

    expect(indexes.map(({ name }) => name)).toEqual([
      'IDX_password_reset_tokens_expires_at',
      'IDX_password_reset_tokens_pending',
      'IDX_password_reset_tokens_usuario_created_at',
      'PK_password_reset_tokens',
      'UQ_password_reset_tokens_pending_usuario',
      'UQ_password_reset_tokens_token_hash',
    ]);
    expect(
      indexes.find(
        ({ name }) => name === 'UQ_password_reset_tokens_pending_usuario',
      )?.definition,
    ).toContain('WHERE ((used_at IS NULL) AND (revoked_at IS NULL))');

    const foreignKeys = (await temporaryDataSource.query(
      `SELECT conname AS "name", pg_get_constraintdef(oid) AS "definition" FROM pg_constraint WHERE conrelid = 'public.password_reset_tokens'::regclass AND contype = 'f'`,
    )) as Array<{ name: string; definition: string }>;
    expect(foreignKeys).toEqual([
      expect.objectContaining({
        name: 'FK_password_reset_tokens_usuario',
        definition: expect.stringContaining('ON DELETE CASCADE'),
      }),
    ]);

    const cascadeUsuarioId = await insertUsuario('cascade-reset@example.com');
    await insertToken({
      usuarioId: cascadeUsuarioId,
      tokenHash: 'd'.repeat(64),
    });
    await temporaryDataSource.query(
      `DELETE FROM "public"."usuarios" WHERE "id" = $1`,
      [cascadeUsuarioId],
    );
    const remaining = (await temporaryDataSource.query(
      `SELECT COUNT(*)::integer AS "count" FROM "public"."password_reset_tokens" WHERE "usuario_id" = $1`,
      [cascadeUsuarioId],
    )) as Array<{ count: number }>;
    expect(remaining).toEqual([{ count: 0 }]);
  });

  async function expectStructures(expected: boolean): Promise<void> {
    const table = (await temporaryDataSource.query(
      `SELECT to_regclass('public.password_reset_tokens') AS "tableName"`,
    )) as Array<{ tableName: string | null }>;
    const column = (await temporaryDataSource.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'usuarios' AND column_name = 'password_changed_at') AS "exists"`,
    )) as Array<{ exists: boolean }>;

    expect(table).toEqual([
      { tableName: expected ? 'password_reset_tokens' : null },
    ]);
    expect(column).toEqual([{ exists: expected }]);
  }

  async function insertUsuario(email: string): Promise<string> {
    const id = randomUUID();
    await temporaryDataSource.query(
      `INSERT INTO "public"."usuarios" ("id", "email", "password_hash", "nombre") VALUES ($1, $2, $3, $4)`,
      [id, email, 'not-a-real-password-hash', 'Password reset test'],
    );
    return id;
  }

  async function insertToken({
    id = randomUUID(),
    usuarioId,
    tokenHash,
    expiresAt = new Date(Date.now() + 3_600_000),
  }: {
    id?: string;
    usuarioId: string;
    tokenHash: string;
    expiresAt?: Date;
  }): Promise<unknown> {
    return temporaryDataSource.query(
      `INSERT INTO "public"."password_reset_tokens" ("id", "usuario_id", "token_hash", "expires_at") VALUES ($1, $2, $3, $4) RETURNING "id"`,
      [id, usuarioId, tokenHash, expiresAt],
    );
  }
});

function postgresConnection() {
  const port = Number(process.env.DB_PORT ?? '5432');
  if (!Number.isInteger(port)) {
    throw new Error('DB_PORT must be an integer for migration tests');
  }

  return {
    type: 'postgres' as const,
    host: process.env.DB_HOST ?? 'localhost',
    port,
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL?.toLowerCase() === 'true',
  };
}

function createTemporaryDatabaseName(): string {
  const name = `vestidos_saas_password_reset_${process.pid}_${Date.now()}`;
  if (!/^[a-z0-9_]+$/.test(name) || name.length > 63) {
    throw new Error('Unsafe temporary database name');
  }
  return name;
}

async function expectConstraintFailure(
  operation: Promise<unknown>,
  code: string,
  constraint: string,
): Promise<void> {
  try {
    await operation;
    throw new Error(`Expected PostgreSQL constraint ${constraint}`);
  } catch (error) {
    expect(error).toBeInstanceOf(QueryFailedError);
    expect(
      (error as QueryFailedError & { driverError: unknown }).driverError,
    ).toMatchObject({ code, constraint });
  }
}
