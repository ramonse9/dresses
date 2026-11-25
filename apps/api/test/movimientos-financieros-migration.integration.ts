import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, QueryFailedError } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { Empresa } from '../src/empresas/entities/empresa.entity.js';
import { EmpresasService } from '../src/empresas/empresas.service.js';
import { quoteTenantSchemaName } from '../src/empresas/tenant-schema-name.js';
import { TenantMigrationService } from '../src/empresas/tenant-migrations/tenant-migration.service.js';

describe('PostgreSQL movimientos financieros tenant migration', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let empresasService: EmpresasService;
  let tenantMigrationService: TenantMigrationService;

  const suffix = `${process.pid}-${Date.now()}`;
  const slugs = [`movimientos-new-${suffix}`, `movimientos-existing-${suffix}`];

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await moduleRef.init();

    dataSource = moduleRef.get(DataSource);
    empresasService = moduleRef.get(EmpresasService);
    tenantMigrationService = moduleRef.get(TenantMigrationService);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      const repository = dataSource.getRepository(Empresa);

      for (const slug of slugs) {
        const empresa = await repository.findOne({ where: { slug } });

        if (empresa) {
          await dataSource.query(
            `DROP SCHEMA IF EXISTS ${quoteTenantSchemaName(empresa.schemaName)} CASCADE`,
          );
          await repository.delete({ id: empresa.id });
        }
      }
    }

    await moduleRef?.close();
  });

  it('provisions constraints, indexes, FKs and append-only behavior for a new tenant', async () => {
    const empresa = await empresasService.create({
      nombre: 'Movimientos New',
      slug: slugs[0],
    });
    const schema = quoteTenantSchemaName(empresa.schemaName);

    const publicTable = (await dataSource.query(
      `SELECT to_regclass('public.movimientos_financieros') AS "tableName"`,
    )) as Array<{ tableName: string | null }>;
    expect(publicTable).toEqual([{ tableName: null }]);

    const columns = (await dataSource.query(
      `SELECT column_name AS "columnName", data_type AS "dataType", numeric_precision AS "precision", numeric_scale AS "scale", character_maximum_length AS "maximumLength" FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'movimientos_financieros' ORDER BY ordinal_position`,
      [empresa.schemaName],
    )) as Array<{
      columnName: string;
      dataType: string;
      precision: number | null;
      scale: number | null;
      maximumLength: number | null;
    }>;
    expect(columns.map(({ columnName }) => columnName)).toEqual([
      'id',
      'reservacion_id',
      'sucursal_id',
      'tipo',
      'monto',
      'metodo_pago',
      'referencia',
      'notas',
      'movimiento_origen_id',
      'idempotency_key',
      'registrado_por_usuario_id',
      'created_at',
    ]);
    expect(columns.find(({ columnName }) => columnName === 'monto')).toEqual(
      expect.objectContaining({
        dataType: 'numeric',
        precision: 12,
        scale: 2,
      }),
    );
    expect(
      columns.find(({ columnName }) => columnName === 'referencia'),
    ).toEqual(expect.objectContaining({ maximumLength: 120 }));
    expect(columns.find(({ columnName }) => columnName === 'notas')).toEqual(
      expect.objectContaining({ maximumLength: 500 }),
    );

    const indexes = (await dataSource.query(
      `SELECT indexname AS "indexName", indexdef AS "definition" FROM pg_indexes WHERE schemaname = $1 AND tablename = 'movimientos_financieros' ORDER BY indexname`,
      [empresa.schemaName],
    )) as Array<{ indexName: string; definition: string }>;
    expect(indexes.map(({ indexName }) => indexName)).toEqual([
      'IDX_movimientos_financieros_origen_id',
      'IDX_movimientos_financieros_registrado_por_created_at',
      'IDX_movimientos_financieros_reservacion_created_at_id',
      'IDX_movimientos_financieros_sucursal_created_at_id',
      'IDX_movimientos_financieros_tipo_created_at',
      'PK_movimientos_financieros_id',
      'UQ_movimientos_financieros_idempotency_key',
    ]);
    expect(
      indexes.find(
        ({ indexName }) =>
          indexName === 'UQ_movimientos_financieros_idempotency_key',
      )?.definition,
    ).toContain('UNIQUE');

    const foreignKeys = (await dataSource.query(
      `SELECT conname AS "name", confdeltype AS "deleteAction" FROM pg_constraint WHERE connamespace = $1::regnamespace AND conrelid = $2::regclass AND contype = 'f' ORDER BY conname`,
      [empresa.schemaName, `${empresa.schemaName}.movimientos_financieros`],
    )) as Array<{ name: string; deleteAction: string }>;
    expect(foreignKeys).toEqual([
      {
        name: 'FK_movimientos_financieros_origen',
        deleteAction: 'r',
      },
      {
        name: 'FK_movimientos_financieros_reservacion',
        deleteAction: 'r',
      },
      {
        name: 'FK_movimientos_financieros_sucursal',
        deleteAction: 'r',
      },
    ]);

    const references = await createReservationReferences(dataSource, schema);
    const actorId = randomUUID();
    const paymentKey = randomUUID();
    const payment = (await dataSource.query(
      `INSERT INTO ${schema}."movimientos_financieros" ("reservacion_id", "sucursal_id", "tipo", "monto", "metodo_pago", "idempotency_key", "registrado_por_usuario_id") VALUES ($1, $2, 'PAGO_RENTA', $3, 'EFECTIVO', $4, $5) RETURNING "id", "monto"`,
      [
        references.reservacionId,
        references.sucursalId,
        '1250.50',
        paymentKey,
        actorId,
      ],
    )) as Array<{ id: string; monto: string }>;
    expect(payment[0]?.monto).toBe('1250.50');

    await dataSource.query(
      `INSERT INTO ${schema}."movimientos_financieros" ("reservacion_id", "sucursal_id", "tipo", "monto", "metodo_pago", "movimiento_origen_id", "idempotency_key", "registrado_por_usuario_id") VALUES ($1, $2, 'REEMBOLSO_RENTA', $3, 'TRANSFERENCIA', $4, $5, $6)`,
      [
        references.reservacionId,
        references.sucursalId,
        '100.00',
        payment[0]?.id,
        randomUUID(),
        actorId,
      ],
    );

    await expectConstraintFailure(
      dataSource.query(
        `INSERT INTO ${schema}."movimientos_financieros" ("reservacion_id", "sucursal_id", "tipo", "monto", "metodo_pago", "idempotency_key", "registrado_por_usuario_id") VALUES ($1, $2, 'PAGO_DEPOSITO', 0, 'EFECTIVO', $3, $4)`,
        [
          references.reservacionId,
          references.sucursalId,
          randomUUID(),
          actorId,
        ],
      ),
      '23514',
      'CHK_movimientos_financieros_monto_positivo',
    );
    await expectConstraintFailure(
      dataSource.query(
        `INSERT INTO ${schema}."movimientos_financieros" ("reservacion_id", "sucursal_id", "tipo", "monto", "metodo_pago", "movimiento_origen_id", "idempotency_key", "registrado_por_usuario_id") VALUES ($1, $2, 'PAGO_RENTA', 1, 'EFECTIVO', $3, $4, $5)`,
        [
          references.reservacionId,
          references.sucursalId,
          payment[0]?.id,
          randomUUID(),
          actorId,
        ],
      ),
      '23514',
      'CHK_movimientos_financieros_origen_por_tipo',
    );
    await expectConstraintFailure(
      dataSource.query(
        `INSERT INTO ${schema}."movimientos_financieros" ("reservacion_id", "sucursal_id", "tipo", "monto", "metodo_pago", "idempotency_key", "registrado_por_usuario_id") VALUES ($1, $2, 'REVERSO', 1, 'EFECTIVO', $3, $4)`,
        [
          references.reservacionId,
          references.sucursalId,
          randomUUID(),
          actorId,
        ],
      ),
      '23514',
      'CHK_movimientos_financieros_origen_por_tipo',
    );
    await expectConstraintFailure(
      dataSource.query(
        `INSERT INTO ${schema}."movimientos_financieros" ("reservacion_id", "sucursal_id", "tipo", "monto", "metodo_pago", "idempotency_key", "registrado_por_usuario_id") VALUES ($1, $2, 'PAGO_RENTA', 1, 'EFECTIVO', $3, $4)`,
        [references.reservacionId, references.sucursalId, paymentKey, actorId],
      ),
      '23505',
      'UQ_movimientos_financieros_idempotency_key',
    );

    await expectDatabaseFailure(
      dataSource.query(
        `UPDATE ${schema}."movimientos_financieros" SET "monto" = 2 WHERE "id" = $1`,
        [payment[0]?.id],
      ),
      '55000',
    );
    await expectDatabaseFailure(
      dataSource.query(
        `DELETE FROM ${schema}."movimientos_financieros" WHERE "id" = $1`,
        [payment[0]?.id],
      ),
      '55000',
    );
  });

  it('applies the pending migration idempotently to an existing tenant', async () => {
    const empresa = await empresasService.create({
      nombre: 'Movimientos Existing',
      slug: slugs[1],
    });
    const schema = quoteTenantSchemaName(empresa.schemaName);

    await dataSource.query(`DROP TABLE ${schema}."movimientos_financieros"`);
    await dataSource.query(
      `DELETE FROM ${schema}."tenant_migrations" WHERE "name" = $1`,
      ['CreateMovimientosFinancieros1795906800000'],
    );

    await tenantMigrationService.ensureMigrations(empresa.schemaName);
    await tenantMigrationService.ensureMigrations(empresa.schemaName);

    const tables = (await dataSource.query(
      `SELECT table_name AS "tableName" FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'movimientos_financieros'`,
      [empresa.schemaName],
    )) as Array<{ tableName: string }>;
    expect(tables).toEqual([{ tableName: 'movimientos_financieros' }]);

    const migrations = (await dataSource.query(
      `SELECT "name" FROM ${schema}."tenant_migrations" WHERE "name" = $1`,
      ['CreateMovimientosFinancieros1795906800000'],
    )) as Array<{ name: string }>;
    expect(migrations).toEqual([
      { name: 'CreateMovimientosFinancieros1795906800000' },
    ]);
  });
});

async function createReservationReferences(
  dataSource: DataSource,
  schema: string,
): Promise<{ reservacionId: string; sucursalId: string }> {
  const sucursal = (await dataSource.query(
    `INSERT INTO ${schema}."sucursales" ("nombre") VALUES ($1) RETURNING "id"`,
    ['Sucursal financiera'],
  )) as Array<{ id: string }>;
  const cliente = (await dataSource.query(
    `INSERT INTO ${schema}."clientes" ("nombre", "email") VALUES ($1, $2) RETURNING "id"`,
    ['Cliente financiero', 'finanzas@example.test'],
  )) as Array<{ id: string }>;
  const reservacion = (await dataSource.query(
    `INSERT INTO ${schema}."reservaciones" ("cliente_id", "sucursal_id", "fecha_inicio", "fecha_fin", "importe_renta", "deposito_requerido") VALUES ($1, $2, $3, $4, 0, 0) RETURNING "id"`,
    [
      cliente[0]?.id,
      sucursal[0]?.id,
      '2027-01-10T16:00:00.000Z',
      '2027-01-12T16:00:00.000Z',
    ],
  )) as Array<{ id: string }>;

  return {
    reservacionId: reservacion[0]?.id ?? '',
    sucursalId: sucursal[0]?.id ?? '',
  };
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
      (error as QueryFailedError & { driverError: unknown }).driverError,
    ).toMatchObject({ code });
  }
}
