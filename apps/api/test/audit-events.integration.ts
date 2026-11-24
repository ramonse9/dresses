import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { DataSource, QueryFailedError } from 'typeorm';
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
} from '../src/audit/audit.constants.js';
import { AuditService } from '../src/audit/audit.service.js';
import { AuditEvent } from '../src/audit/entities/audit-event.entity.js';
import { CreateEmpresas1794376396639 } from '../src/database/migrations/1794376396639-CreateEmpresas.js';
import { CreateUsuariosMemberships1794442297164 } from '../src/database/migrations/1794442297164-CreateUsuariosMemberships.js';
import { CreateAuthSessions1794528000000 } from '../src/database/migrations/1794528000000-CreateAuthSessions.js';
import { CreateEmpresaInvitaciones1795561200000 } from '../src/database/migrations/1795561200000-CreateEmpresaInvitaciones.js';
import { CreatePasswordResetTokens1795647600000 } from '../src/database/migrations/1795647600000-CreatePasswordResetTokens.js';
import { AddAuthSessionMetadata1795734000000 } from '../src/database/migrations/1795734000000-AddAuthSessionMetadata.js';
import { CreateAuditEvents1795820400000 } from '../src/database/migrations/1795820400000-CreateAuditEvents.js';
import { TenantContextService } from '../src/database/tenant-context.service.js';
import { Empresa } from '../src/empresas/entities/empresa.entity.js';
import { tenantSchemaNameFromEmpresaId } from '../src/empresas/tenant-schema-name.js';
import { createTenantScope } from '../src/tenancy/tenant-scope.js';

describe('PostgreSQL audit events', () => {
  let adminDataSource: DataSource;
  let temporaryDataSource: DataSource;
  let auditService: AuditService;
  let tenantContext: TenantContextService;
  const databaseName = createTemporaryDatabaseName();
  const empresaId = randomUUID();
  const tenantSchema = tenantSchemaNameFromEmpresaId(empresaId);
  const tenantScope = createTenantScope({
    id: empresaId,
    slug: 'audit-test',
    schemaName: tenantSchema,
  } as Empresa);

  beforeAll(async () => {
    const connection = postgresConnection();
    adminDataSource = new DataSource({ ...connection, database: 'postgres' });
    await adminDataSource.initialize();
    await adminDataSource.query(`CREATE DATABASE "${databaseName}"`);

    temporaryDataSource = new DataSource({
      ...connection,
      database: databaseName,
      entities: [AuditEvent],
      migrationsTableName: 'typeorm_migrations',
      migrations: [
        CreateEmpresas1794376396639,
        CreateUsuariosMemberships1794442297164,
        CreateAuthSessions1794528000000,
        CreateEmpresaInvitaciones1795561200000,
        CreatePasswordResetTokens1795647600000,
        AddAuthSessionMetadata1795734000000,
        CreateAuditEvents1795820400000,
      ],
      synchronize: false,
      migrationsRun: false,
    });
    await temporaryDataSource.initialize();
    await temporaryDataSource.query(
      'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"',
    );
    await temporaryDataSource.query(`CREATE SCHEMA "${tenantSchema}"`);
    auditService = new AuditService(temporaryDataSource);
    tenantContext = new TenantContextService(temporaryDataSource);
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

  it('migrates a new database and supports down/up', async () => {
    const applied = await temporaryDataSource.runMigrations();
    expect(applied.map(({ name }) => name)).toEqual([
      'CreateEmpresas1794376396639',
      'CreateUsuariosMemberships1794442297164',
      'CreateAuthSessions1794528000000',
      'CreateEmpresaInvitaciones1795561200000',
      'CreatePasswordResetTokens1795647600000',
      'AddAuthSessionMetadata1795734000000',
      'CreateAuditEvents1795820400000',
    ]);
    await expectStructures(true);

    await temporaryDataSource.undoLastMigration();
    await expectStructures(false);

    const reapplied = await temporaryDataSource.runMigrations();
    expect(reapplied.map(({ name }) => name)).toEqual([
      'CreateAuditEvents1795820400000',
    ]);
    await expectStructures(true);
  });

  it('records global and company-scoped events in public', async () => {
    const globalEvent = await auditService.record({
      action: AUDIT_ACTIONS.AUTH_LOGOUT,
      resourceType: AUDIT_RESOURCE_TYPES.AUTH_SESSION,
      resourceId: randomUUID(),
      metadata: { current: true, token: 'must-not-be-stored' },
      safeMetadataFields: ['current', 'token'],
      ipAddress: '203.0.113.10',
      userAgent: 'Integration Browser',
    });
    const companyEvent = await auditService.record({
      empresaId,
      action: AUDIT_ACTIONS.MEMBERSHIP_STATUS_CHANGED,
      resourceType: AUDIT_RESOURCE_TYPES.MEMBERSHIP,
      resourceId: randomUUID(),
      metadata: { active: false },
      safeMetadataFields: ['active'],
    });

    const rows = (await temporaryDataSource.query(
      `SELECT "id", "empresa_id" AS "empresaId", "metadata" FROM "public"."audit_events" WHERE "id" IN ($1, $2) ORDER BY "empresa_id" NULLS FIRST`,
      [globalEvent.id, companyEvent.id],
    )) as Array<Record<string, unknown>>;
    expect(rows).toEqual([
      expect.objectContaining({ empresaId: null, metadata: { current: true } }),
      expect.objectContaining({ empresaId, metadata: { active: false } }),
    ]);
    expect(JSON.stringify(rows)).not.toMatch(
      /must-not-be-stored|schemaName|tenant_/,
    );
  });

  it('writes through the existing tenant transaction and rolls back together', async () => {
    const committedResourceId = randomUUID();
    await tenantContext.run(tenantScope, async (manager) => {
      await auditService.record(
        {
          empresaId,
          action: AUDIT_ACTIONS.TENANT_RESOURCE_CREATED,
          resourceType: AUDIT_RESOURCE_TYPES.DRESS,
          resourceId: committedResourceId,
          metadata: { code: 'AUDIT-001' },
          safeMetadataFields: ['code'],
        },
        manager,
      );
    });

    const rolledBackResourceId = randomUUID();
    await expect(
      tenantContext.run(tenantScope, async (manager) => {
        await auditService.record(
          {
            empresaId,
            action: AUDIT_ACTIONS.TENANT_RESOURCE_UPDATED,
            resourceType: AUDIT_RESOURCE_TYPES.DRESS,
            resourceId: rolledBackResourceId,
          },
          manager,
        );
        throw new Error('force rollback');
      }),
    ).rejects.toThrow('force rollback');

    const rows = (await temporaryDataSource.query(
      `SELECT "resource_id" AS "resourceId" FROM "public"."audit_events" WHERE "resource_id" IN ($1, $2)`,
      [committedResourceId, rolledBackResourceId],
    )) as Array<{ resourceId: string }>;
    expect(rows).toEqual([{ resourceId: committedResourceId }]);
  });

  it('rejects updates and deletes at the database level', async () => {
    const event = await auditService.record({
      action: AUDIT_ACTIONS.AUTH_LOGIN_SUCCEEDED,
      resourceType: AUDIT_RESOURCE_TYPES.USER,
    });

    await expectDatabaseFailure(
      temporaryDataSource.query(
        `UPDATE "public"."audit_events" SET "action" = $1 WHERE "id" = $2`,
        [AUDIT_ACTIONS.AUTH_LOGOUT, event.id],
      ),
      '55000',
    );
    await expectDatabaseFailure(
      temporaryDataSource.query(
        `DELETE FROM "public"."audit_events" WHERE "id" = $1`,
        [event.id],
      ),
      '55000',
    );
  });

  async function expectStructures(expected: boolean): Promise<void> {
    const table = (await temporaryDataSource.query(
      `SELECT to_regclass('public.audit_events') AS "tableName"`,
    )) as Array<{ tableName: string | null }>;
    expect(table).toEqual([{ tableName: expected ? 'audit_events' : null }]);

    const indexes = (await temporaryDataSource.query(
      `SELECT indexname AS "name" FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'audit_events' ORDER BY indexname`,
    )) as Array<{ name: string }>;
    expect(indexes.map(({ name }) => name)).toEqual(
      expected
        ? [
            'IDX_audit_events_action_created_at',
            'IDX_audit_events_actor_created_at',
            'IDX_audit_events_empresa_created_at_id',
            'IDX_audit_events_resource_created_at',
            'PK_audit_events',
          ]
        : [],
    );

    const triggers = (await temporaryDataSource.query(
      `SELECT tgname AS "name" FROM pg_trigger WHERE tgrelid = to_regclass('public.audit_events') AND NOT tgisinternal`,
    )) as Array<{ name: string }>;
    expect(triggers).toEqual(
      expected ? [{ name: 'TRG_audit_events_immutable' }] : [],
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
  const name = `vestidos_saas_audit_${process.pid}_${Date.now()}`;
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
    throw new Error('Expected the database operation to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(QueryFailedError);
    expect((error as QueryFailedError & { code?: string }).code).toBe(code);
  }
}
