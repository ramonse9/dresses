import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { DataSource, QueryFailedError } from 'typeorm';
import { CreateEmpresas1794376396639 } from '../src/database/migrations/1794376396639-CreateEmpresas.js';
import { CreateUsuariosMemberships1794442297164 } from '../src/database/migrations/1794442297164-CreateUsuariosMemberships.js';
import { CreateAuthSessions1794528000000 } from '../src/database/migrations/1794528000000-CreateAuthSessions.js';
import { CreateEmpresaInvitaciones1795561200000 } from '../src/database/migrations/1795561200000-CreateEmpresaInvitaciones.js';
import { CreatePasswordResetTokens1795647600000 } from '../src/database/migrations/1795647600000-CreatePasswordResetTokens.js';
import { AddAuthSessionMetadata1795734000000 } from '../src/database/migrations/1795734000000-AddAuthSessionMetadata.js';

const previousMigrations = [
  CreateEmpresas1794376396639,
  CreateUsuariosMemberships1794442297164,
  CreateAuthSessions1794528000000,
  CreateEmpresaInvitaciones1795561200000,
  CreatePasswordResetTokens1795647600000,
];

describe('PostgreSQL auth session metadata migration', () => {
  let adminDataSource: DataSource;
  let temporaryDataSource: DataSource;
  const databaseName = createTemporaryDatabaseName();
  const usuarioId = randomUUID();
  const sessionId = randomUUID();
  const existingTimestamp = new Date('2026-11-20T18:00:00.000Z');

  beforeAll(async () => {
    const connection = postgresConnection();
    adminDataSource = new DataSource({ ...connection, database: 'postgres' });
    await adminDataSource.initialize();
    await adminDataSource.query(`CREATE DATABASE "${databaseName}"`);

    const previousDataSource = new DataSource({
      ...connection,
      database: databaseName,
      migrationsTableName: 'typeorm_migrations',
      migrations: previousMigrations,
      synchronize: false,
      migrationsRun: false,
    });
    await previousDataSource.initialize();
    await previousDataSource.query(
      'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"',
    );
    await previousDataSource.runMigrations();
    await previousDataSource.query(
      `INSERT INTO "public"."usuarios" ("id", "email", "password_hash", "nombre") VALUES ($1, $2, $3, $4)`,
      [
        usuarioId,
        'existing-session@example.com',
        'test-password-hash',
        'Existing session',
      ],
    );
    await previousDataSource.query(
      `INSERT INTO "public"."auth_sessions" ("id", "usuario_id", "refresh_token_hash", "expires_at", "created_at", "updated_at") VALUES ($1, $2, $3, $4, $5, $5)`,
      [
        sessionId,
        usuarioId,
        'a'.repeat(64),
        new Date('2027-01-01T00:00:00.000Z'),
        existingTimestamp,
      ],
    );
    await previousDataSource.destroy();

    temporaryDataSource = new DataSource({
      ...connection,
      database: databaseName,
      migrationsTableName: 'typeorm_migrations',
      migrations: [...previousMigrations, AddAuthSessionMetadata1795734000000],
      synchronize: false,
      migrationsRun: false,
    });
    await temporaryDataSource.initialize();
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

  it('backfills existing sessions and supports down/up', async () => {
    const applied = await temporaryDataSource.runMigrations();
    expect(applied.map(({ name }) => name)).toEqual([
      'AddAuthSessionMetadata1795734000000',
    ]);

    const rows = (await temporaryDataSource.query(
      `SELECT "last_seen_at" AS "lastSeenAt", "ip_address" AS "ipAddress", "user_agent" AS "userAgent", "revoked_by_usuario_id" AS "revokedByUsuarioId" FROM "public"."auth_sessions" WHERE "id" = $1`,
      [sessionId],
    )) as Array<Record<string, unknown>>;
    expect(rows).toEqual([
      {
        lastSeenAt: existingTimestamp,
        ipAddress: null,
        userAgent: null,
        revokedByUsuarioId: null,
      },
    ]);
    await expectStructures(true);

    await temporaryDataSource.undoLastMigration();
    await expectStructures(false);
    const reapplied = await temporaryDataSource.runMigrations();
    expect(reapplied.map(({ name }) => name)).toEqual([
      'AddAuthSessionMetadata1795734000000',
    ]);
    await expectStructures(true);
  });

  it('enforces inet and user-agent length and applies the revocation actor relation', async () => {
    const actorId = randomUUID();
    await temporaryDataSource.query(
      `INSERT INTO "public"."usuarios" ("id", "email", "password_hash", "nombre") VALUES ($1, $2, $3, $4)`,
      [
        actorId,
        'session-actor@example.com',
        'test-password-hash',
        'Session actor',
      ],
    );
    await temporaryDataSource.query(
      `UPDATE "public"."auth_sessions" SET "ip_address" = $1, "user_agent" = $2, "revoked_by_usuario_id" = $3 WHERE "id" = $4`,
      ['203.0.113.10', 'Browser/1.0', actorId, sessionId],
    );

    await expectDatabaseFailure(
      temporaryDataSource.query(
        `UPDATE "public"."auth_sessions" SET "ip_address" = $1 WHERE "id" = $2`,
        ['untrusted-forwarded-value', sessionId],
      ),
      '22P02',
    );
    await expectDatabaseFailure(
      temporaryDataSource.query(
        `UPDATE "public"."auth_sessions" SET "user_agent" = $1 WHERE "id" = $2`,
        ['x'.repeat(513), sessionId],
      ),
      '22001',
    );

    await temporaryDataSource.query(
      `DELETE FROM "public"."usuarios" WHERE "id" = $1`,
      [actorId],
    );
    const remaining = (await temporaryDataSource.query(
      `SELECT "revoked_by_usuario_id" AS "revokedByUsuarioId" FROM "public"."auth_sessions" WHERE "id" = $1`,
      [sessionId],
    )) as Array<{ revokedByUsuarioId: string | null }>;
    expect(remaining).toEqual([{ revokedByUsuarioId: null }]);
  });

  async function expectStructures(expected: boolean): Promise<void> {
    const columns = (await temporaryDataSource.query(
      `SELECT column_name AS "name", data_type AS "type", character_maximum_length AS "length", is_nullable AS "nullable" FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'auth_sessions' AND column_name IN ('ip_address', 'user_agent', 'last_seen_at', 'revoked_by_usuario_id') ORDER BY column_name`,
    )) as Array<Record<string, unknown>>;
    expect(columns).toHaveLength(expected ? 4 : 0);
    if (expected) {
      expect(columns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'ip_address',
            type: 'inet',
            nullable: 'YES',
          }),
          expect.objectContaining({
            name: 'user_agent',
            type: 'character varying',
            length: 512,
          }),
          expect.objectContaining({
            name: 'last_seen_at',
            type: 'timestamp with time zone',
            nullable: 'NO',
          }),
        ]),
      );
    }

    const indexes = (await temporaryDataSource.query(
      `SELECT indexname AS "name" FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'auth_sessions' AND indexname IN ('IDX_auth_sessions_usuario_revoked_at', 'IDX_auth_sessions_usuario_last_seen_at') ORDER BY indexname`,
    )) as Array<{ name: string }>;
    expect(indexes).toHaveLength(expected ? 2 : 0);
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
  const name = `vestidos_saas_session_meta_${process.pid}_${Date.now()}`;
  if (!/^[a-z0-9_]+$/.test(name) || name.length > 63) {
    throw new Error('Unsafe temporary database name');
  }
  return name;
}

async function expectDatabaseFailure(
  operation: Promise<unknown>,
  code: string,
): Promise<void> {
  try {
    await operation;
    throw new Error(`Expected PostgreSQL error ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(QueryFailedError);
    expect(
      (error as QueryFailedError & { driverError: { code: string } })
        .driverError.code,
    ).toBe(code);
  }
}
