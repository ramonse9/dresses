import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { DataSource, QueryFailedError } from 'typeorm';
import { CreateEmpresas1794376396639 } from '../src/database/migrations/1794376396639-CreateEmpresas.js';
import { CreateUsuariosMemberships1794442297164 } from '../src/database/migrations/1794442297164-CreateUsuariosMemberships.js';
import { CreateAuthSessions1794528000000 } from '../src/database/migrations/1794528000000-CreateAuthSessions.js';
import { CreateEmpresaInvitaciones1795561200000 } from '../src/database/migrations/1795561200000-CreateEmpresaInvitaciones.js';

describe('PostgreSQL empresa invitations migration', () => {
  let adminDataSource: DataSource;
  let temporaryDataSource: DataSource;
  const databaseName = createTemporaryDatabaseName();

  beforeAll(async () => {
    const connection = postgresConnection();
    adminDataSource = new DataSource({
      ...connection,
      database: 'postgres',
    });
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

    expect(applied.map(({ name }) => name)).toEqual([
      'CreateEmpresas1794376396639',
      'CreateUsuariosMemberships1794442297164',
      'CreateAuthSessions1794528000000',
      'CreateEmpresaInvitaciones1795561200000',
    ]);
    await expectInvitationTable(true);

    await temporaryDataSource.undoLastMigration();
    await expectInvitationTable(false);

    const reapplied = await temporaryDataSource.runMigrations();
    expect(reapplied.map(({ name }) => name)).toEqual([
      'CreateEmpresaInvitaciones1795561200000',
    ]);
    await expectInvitationTable(true);

    const migrations = (await temporaryDataSource.query(
      `SELECT "name" FROM "typeorm_migrations" ORDER BY "timestamp"`,
    )) as Array<{ name: string }>;
    expect(migrations.map(({ name }) => name)).toContain(
      'CreateEmpresaInvitaciones1795561200000',
    );
  });

  it('enforces normalized data, valid roles, hashes, counts and pending uniqueness', async () => {
    const empresaId = randomUUID();
    const creatorId = randomUUID();
    await temporaryDataSource.query(
      `INSERT INTO "public"."empresas" ("id", "nombre", "slug", "schema_name") VALUES ($1, $2, $3, $4)`,
      [empresaId, 'Invitations Test', 'invitations-test', tenantSchemaName()],
    );
    await temporaryDataSource.query(
      `INSERT INTO "public"."usuarios" ("id", "email", "password_hash", "nombre") VALUES ($1, $2, $3, $4)`,
      [creatorId, 'creator@example.com', 'not-a-real-password-hash', 'Creator'],
    );

    const pendingId = randomUUID();
    await insertInvitation({
      id: pendingId,
      empresaId,
      creatorId,
      email: 'pending@example.com',
      tokenHash: 'a'.repeat(64),
      expiresAt: new Date(Date.now() - 60_000),
    });

    await expectConstraintFailure(
      insertInvitation({
        empresaId,
        creatorId,
        email: 'pending@example.com',
        tokenHash: 'b'.repeat(64),
      }),
      '23505',
      'UQ_empresa_invitaciones_pendiente_empresa_email',
    );
    await expectConstraintFailure(
      insertInvitation({
        empresaId,
        creatorId,
        email: 'different@example.com',
        tokenHash: 'a'.repeat(64),
      }),
      '23505',
      'UQ_empresa_invitaciones_token_hash',
    );
    await expectConstraintFailure(
      insertInvitation({
        empresaId,
        creatorId,
        email: 'UPPER@EXAMPLE.COM',
        tokenHash: 'c'.repeat(64),
      }),
      '23514',
      'CHK_empresa_invitaciones_email_normalized',
    );
    await expectConstraintFailure(
      insertInvitation({
        empresaId,
        creatorId,
        email: 'role@example.com',
        tokenHash: 'd'.repeat(64),
        role: 'ADMIN',
      }),
      '23514',
      'CHK_empresa_invitaciones_rol',
    );
    await expectConstraintFailure(
      insertInvitation({
        empresaId,
        creatorId,
        email: 'hash@example.com',
        tokenHash: 'short-hash',
      }),
      '23514',
      'CHK_empresa_invitaciones_token_hash',
    );
    await expectConstraintFailure(
      insertInvitation({
        empresaId,
        creatorId,
        email: 'count@example.com',
        tokenHash: 'e'.repeat(64),
        sendCount: -1,
      }),
      '23514',
      'CHK_empresa_invitaciones_send_count',
    );

    await temporaryDataSource.query(
      `UPDATE "public"."empresa_invitaciones" SET "revoked_at" = now() WHERE "id" = $1`,
      [pendingId],
    );
    await expect(
      insertInvitation({
        empresaId,
        creatorId,
        email: 'pending@example.com',
        tokenHash: 'f'.repeat(64),
      }),
    ).resolves.toBeDefined();
  });

  it('creates all required indexes and restricted foreign keys in public', async () => {
    const indexes = (await temporaryDataSource.query(
      `SELECT indexname AS "name", indexdef AS "definition" FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'empresa_invitaciones' ORDER BY indexname`,
    )) as Array<{ name: string; definition: string }>;
    expect(indexes.map(({ name }) => name)).toEqual([
      'IDX_empresa_invitaciones_empresa_created_at',
      'IDX_empresa_invitaciones_empresa_email',
      'IDX_empresa_invitaciones_expires_at',
      'IDX_empresa_invitaciones_pendientes',
      'PK_empresa_invitaciones',
      'UQ_empresa_invitaciones_pendiente_empresa_email',
      'UQ_empresa_invitaciones_token_hash',
    ]);
    expect(
      indexes.find(
        ({ name }) =>
          name === 'UQ_empresa_invitaciones_pendiente_empresa_email',
      )?.definition,
    ).toContain('WHERE ((accepted_at IS NULL) AND (revoked_at IS NULL))');

    const foreignKeys = (await temporaryDataSource.query(
      `SELECT conname AS "name", pg_get_constraintdef(oid) AS "definition" FROM pg_constraint WHERE conrelid = 'public.empresa_invitaciones'::regclass AND contype = 'f' ORDER BY conname`,
    )) as Array<{ name: string; definition: string }>;
    expect(foreignKeys).toHaveLength(3);
    expect(
      foreignKeys.every(({ definition }) =>
        definition.includes('ON DELETE RESTRICT'),
      ),
    ).toBe(true);
  });

  async function expectInvitationTable(expected: boolean): Promise<void> {
    const result = (await temporaryDataSource.query(
      `SELECT to_regclass('public.empresa_invitaciones') AS "tableName"`,
    )) as Array<{ tableName: string | null }>;
    expect(result).toEqual([
      { tableName: expected ? 'empresa_invitaciones' : null },
    ]);
  }

  async function insertInvitation({
    id = randomUUID(),
    empresaId,
    creatorId,
    email,
    tokenHash,
    expiresAt = new Date(Date.now() + 3_600_000),
    role = 'EMPLOYEE',
    sendCount = 0,
  }: {
    id?: string;
    empresaId: string;
    creatorId: string;
    email: string;
    tokenHash: string;
    expiresAt?: Date;
    role?: string;
    sendCount?: number;
  }): Promise<unknown> {
    return temporaryDataSource.query(
      `INSERT INTO "public"."empresa_invitaciones" ("id", "empresa_id", "email", "rol", "token_hash", "expires_at", "created_by_usuario_id", "send_count") VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING "id"`,
      [id, empresaId, email, role, tokenHash, expiresAt, creatorId, sendCount],
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
  const name = `vestidos_saas_invitaciones_${process.pid}_${Date.now()}`;
  if (!/^[a-z0-9_]+$/.test(name) || name.length > 63) {
    throw new Error('Unsafe temporary database name');
  }
  return name;
}

function tenantSchemaName(): string {
  return `tenant_${randomUUID().replaceAll('-', '')}`;
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
