import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, QueryFailedError } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { Empresa } from '../src/empresas/entities/empresa.entity.js';
import { EmpresasService } from '../src/empresas/empresas.service.js';
import { quoteTenantSchemaName } from '../src/empresas/tenant-schema-name.js';
import { TenantMigrationService } from '../src/empresas/tenant-migrations/tenant-migration.service.js';

describe('PostgreSQL reservaciones tenant migration', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let empresasService: EmpresasService;
  let tenantMigrationService: TenantMigrationService;

  const suffix = `${process.pid}-${Date.now()}`;
  const slugs = [
    `reservaciones-new-${suffix}`,
    `reservaciones-existing-${suffix}`,
  ];

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

  it('provisions the reservation model only inside a new tenant', async () => {
    const empresa = await empresasService.create({
      nombre: 'Reservaciones New',
      slug: slugs[0],
    });
    const schema = quoteTenantSchemaName(empresa.schemaName);

    const tables = (await dataSource.query(
      `SELECT table_name AS "tableName" FROM information_schema.tables WHERE table_schema = $1 AND table_name IN ('reservaciones', 'reservacion_vestidos') ORDER BY table_name`,
      [empresa.schemaName],
    )) as Array<{ tableName: string }>;
    expect(tables).toEqual([
      { tableName: 'reservacion_vestidos' },
      { tableName: 'reservaciones' },
    ]);

    const publicTables = (await dataSource.query(
      `SELECT table_name AS "tableName" FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('reservaciones', 'reservacion_vestidos')`,
    )) as Array<{ tableName: string }>;
    expect(publicTables).toEqual([]);

    const migrationRows = (await dataSource.query(
      `SELECT "name" FROM ${schema}."tenant_migrations" WHERE "name" = $1`,
      ['CreateReservaciones1795215600000'],
    )) as Array<{ name: string }>;
    expect(migrationRows).toEqual([
      { name: 'CreateReservaciones1795215600000' },
    ]);

    const columns = (await dataSource.query(
      `SELECT table_name AS "tableName", column_name AS "columnName", data_type AS "dataType", numeric_precision AS "precision", numeric_scale AS "scale", column_default AS "defaultValue" FROM information_schema.columns WHERE table_schema = $1 AND table_name IN ('reservaciones', 'reservacion_vestidos') ORDER BY table_name, ordinal_position`,
      [empresa.schemaName],
    )) as Array<{
      tableName: string;
      columnName: string;
      dataType: string;
      precision: number | null;
      scale: number | null;
      defaultValue: string | null;
    }>;
    expect(
      columns
        .filter(({ columnName }) =>
          [
            'importe_renta',
            'deposito_requerido',
            'precio_renta',
            'deposito',
          ].includes(columnName),
        )
        .every(
          ({ dataType, precision, scale }) =>
            dataType === 'numeric' && precision === 12 && scale === 2,
        ),
    ).toBe(true);
    expect(
      columns
        .filter(({ columnName }) =>
          [
            'fecha_inicio',
            'fecha_fin',
            'confirmada_at',
            'entregada_at',
            'devuelta_at',
            'cancelada_at',
          ].includes(columnName),
        )
        .every(({ dataType }) => dataType === 'timestamp with time zone'),
    ).toBe(true);
    expect(
      columns.find(
        ({ tableName, columnName }) =>
          tableName === 'reservaciones' && columnName === 'estado',
      )?.defaultValue,
    ).toContain('BORRADOR');

    const foreignKeys = (await dataSource.query(
      `SELECT constraint_name AS "name", delete_rule AS "deleteRule" FROM information_schema.referential_constraints WHERE constraint_schema = $1 AND constraint_name IN ('FK_reservaciones_cliente', 'FK_reservaciones_sucursal', 'FK_reservacion_vestidos_vestido') ORDER BY constraint_name`,
      [empresa.schemaName],
    )) as Array<{ name: string; deleteRule: string }>;
    expect(foreignKeys).toEqual([
      {
        name: 'FK_reservacion_vestidos_vestido',
        deleteRule: 'RESTRICT',
      },
      { name: 'FK_reservaciones_cliente', deleteRule: 'RESTRICT' },
      { name: 'FK_reservaciones_sucursal', deleteRule: 'RESTRICT' },
    ]);

    const indexes = (await dataSource.query(
      `SELECT tablename AS "tableName", indexname AS "indexName", indexdef AS "definition" FROM pg_indexes WHERE schemaname = $1 AND tablename IN ('reservaciones', 'reservacion_vestidos') ORDER BY indexname`,
      [empresa.schemaName],
    )) as Array<{
      tableName: string;
      indexName: string;
      definition: string;
    }>;
    expect(indexes.map(({ indexName }) => indexName)).toEqual(
      expect.arrayContaining([
        'IDX_reservaciones_cliente_created_at',
        'IDX_reservaciones_sucursal_estado_fechas',
        'IDX_reservaciones_estado_fechas',
        'IDX_reservacion_vestidos_reservacion_id',
        'IDX_reservacion_vestidos_vestido_id',
        'UQ_reservacion_vestidos_reservacion_vestido',
      ]),
    );
    expect(
      indexes.find(
        ({ indexName }) =>
          indexName === 'UQ_reservacion_vestidos_reservacion_vestido',
      )?.definition,
    ).toContain('UNIQUE');

    const [sucursal] = (await dataSource.query(
      `INSERT INTO ${schema}."sucursales" ("nombre") VALUES ($1) RETURNING "id"`,
      ['Centro'],
    )) as Array<{ id: string }>;
    const [sucursalSoloReservacion] = (await dataSource.query(
      `INSERT INTO ${schema}."sucursales" ("nombre") VALUES ($1) RETURNING "id"`,
      ['Norte'],
    )) as Array<{ id: string }>;
    const [cliente] = (await dataSource.query(
      `INSERT INTO ${schema}."clientes" ("nombre", "email") VALUES ($1, $2) RETURNING "id"`,
      ['Ana López', 'ana@example.com'],
    )) as Array<{ id: string }>;
    const vestidos = (await dataSource.query(
      `INSERT INTO ${schema}."vestidos" ("sucursal_id", "codigo", "nombre", "talla", "color", "precio_renta", "deposito") VALUES ($1, $2, $3, $4, $5, $6, $7), ($1, $8, $9, $10, $11, $12, $13) RETURNING "id", "codigo"`,
      [
        sucursal?.id,
        'R-001',
        'Vestido Azul',
        'M',
        'Azul',
        '1250.50',
        '500.00',
        'R-002',
        'Vestido Rojo',
        'G',
        'Rojo',
        '900.00',
        null,
      ],
    )) as Array<{ id: string; codigo: string }>;
    const vestidoA = vestidos.find(({ codigo }) => codigo === 'R-001');
    const vestidoB = vestidos.find(({ codigo }) => codigo === 'R-002');

    const [reservacion] = (await dataSource.query(
      `INSERT INTO ${schema}."reservaciones" ("cliente_id", "sucursal_id", "fecha_inicio", "fecha_fin", "importe_renta", "deposito_requerido") VALUES ($1, $2, $3, $4, $5, $6) RETURNING "id", "estado"`,
      [
        cliente?.id,
        sucursal?.id,
        '2026-12-10T16:00:00.000Z',
        '2026-12-12T16:00:00.000Z',
        '2150.50',
        '500.00',
      ],
    )) as Array<{ id: string; estado: string }>;
    expect(reservacion?.estado).toBe('BORRADOR');

    await dataSource.query(
      `INSERT INTO ${schema}."reservacion_vestidos" ("reservacion_id", "vestido_id", "precio_renta", "deposito") VALUES ($1, $2, $3, $4), ($1, $5, $6, $7)`,
      [
        reservacion?.id,
        vestidoA?.id,
        '1250.50',
        '500.00',
        vestidoB?.id,
        '900.00',
        '0.00',
      ],
    );

    await dataSource.query(
      `UPDATE ${schema}."vestidos" SET "precio_renta" = $1, "deposito" = $2 WHERE "id" = $3`,
      ['2000.00', '900.00', vestidoA?.id],
    );
    const historicalAmounts = (await dataSource.query(
      `SELECT "precio_renta" AS "precioRenta", "deposito" FROM ${schema}."reservacion_vestidos" WHERE "reservacion_id" = $1 AND "vestido_id" = $2`,
      [reservacion?.id, vestidoA?.id],
    )) as Array<{ precioRenta: string; deposito: string }>;
    expect(historicalAmounts).toEqual([
      { precioRenta: '1250.50', deposito: '500.00' },
    ]);

    const [reservacionLimite] = (await dataSource.query(
      `INSERT INTO ${schema}."reservaciones" ("cliente_id", "sucursal_id", "fecha_inicio", "fecha_fin", "importe_renta", "deposito_requerido") VALUES ($1, $2, $3, $4, $5, $6) RETURNING "id"`,
      [
        cliente?.id,
        sucursal?.id,
        '2026-12-12T16:00:00.000Z',
        '2026-12-13T16:00:00.000Z',
        '100.00',
        '0.00',
      ],
    )) as Array<{ id: string }>;
    expect(reservacionLimite?.id).toBeDefined();

    const [reservacionSucursal] = (await dataSource.query(
      `INSERT INTO ${schema}."reservaciones" ("cliente_id", "sucursal_id", "fecha_inicio", "fecha_fin", "importe_renta", "deposito_requerido") VALUES ($1, $2, $3, $4, $5, $6) RETURNING "id"`,
      [
        cliente?.id,
        sucursalSoloReservacion?.id,
        '2027-01-10T16:00:00.000Z',
        '2027-01-11T16:00:00.000Z',
        '100.00',
        '0.00',
      ],
    )) as Array<{ id: string }>;
    expect(reservacionSucursal?.id).toBeDefined();

    await expectFailure(
      dataSource.query(
        `INSERT INTO ${schema}."reservaciones" ("cliente_id", "sucursal_id", "fecha_inicio", "fecha_fin", "importe_renta", "deposito_requerido") VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          cliente?.id,
          sucursal?.id,
          '2026-12-12T16:00:00.000Z',
          '2026-12-12T16:00:00.000Z',
          '100.00',
          '0.00',
        ],
      ),
      '23514',
      'CHK_reservaciones_fechas',
    );
    await expectFailure(
      dataSource.query(
        `INSERT INTO ${schema}."reservaciones" ("cliente_id", "sucursal_id", "fecha_inicio", "fecha_fin", "estado", "importe_renta", "deposito_requerido") VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          cliente?.id,
          sucursal?.id,
          '2027-02-10T16:00:00.000Z',
          '2027-02-11T16:00:00.000Z',
          'PAGADA',
          '100.00',
          '0.00',
        ],
      ),
      '23514',
      'CHK_reservaciones_estado',
    );
    await expectFailure(
      dataSource.query(
        `INSERT INTO ${schema}."reservaciones" ("cliente_id", "sucursal_id", "fecha_inicio", "fecha_fin", "importe_renta", "deposito_requerido") VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          cliente?.id,
          sucursal?.id,
          '2027-03-10T16:00:00.000Z',
          '2027-03-11T16:00:00.000Z',
          '-1.00',
          '0.00',
        ],
      ),
      '23514',
      'CHK_reservaciones_importe_renta',
    );
    await expectFailure(
      dataSource.query(
        `INSERT INTO ${schema}."reservaciones" ("cliente_id", "sucursal_id", "fecha_inicio", "fecha_fin", "importe_renta", "deposito_requerido") VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          cliente?.id,
          sucursal?.id,
          '2027-03-12T16:00:00.000Z',
          '2027-03-13T16:00:00.000Z',
          '1.00',
          '-1.00',
        ],
      ),
      '23514',
      'CHK_reservaciones_deposito_requerido',
    );
    await expectFailure(
      dataSource.query(
        `INSERT INTO ${schema}."reservacion_vestidos" ("reservacion_id", "vestido_id", "precio_renta", "deposito") VALUES ($1, $2, $3, $4)`,
        [reservacionLimite?.id, vestidoB?.id, '-1.00', '0.00'],
      ),
      '23514',
      'CHK_reservacion_vestidos_precio_renta',
    );
    await expectFailure(
      dataSource.query(
        `INSERT INTO ${schema}."reservacion_vestidos" ("reservacion_id", "vestido_id", "precio_renta", "deposito") VALUES ($1, $2, $3, $4)`,
        [reservacionLimite?.id, vestidoB?.id, '1.00', '-1.00'],
      ),
      '23514',
      'CHK_reservacion_vestidos_deposito',
    );
    await expectFailure(
      dataSource.query(
        `INSERT INTO ${schema}."reservacion_vestidos" ("reservacion_id", "vestido_id", "precio_renta", "deposito") VALUES ($1, $2, $3, $4)`,
        [reservacion?.id, vestidoA?.id, '1.00', '0.00'],
      ),
      '23505',
      'UQ_reservacion_vestidos_reservacion_vestido',
    );
    await expectFailure(
      dataSource.query(
        `INSERT INTO ${schema}."reservacion_vestidos" ("reservacion_id", "vestido_id", "precio_renta", "deposito") VALUES ($1, $2, $3, $4)`,
        [
          reservacion?.id,
          '00000000-0000-4000-8000-000000000000',
          '1.00',
          '0.00',
        ],
      ),
      '23503',
      'FK_reservacion_vestidos_vestido',
    );
    await expectFailure(
      dataSource.query(`DELETE FROM ${schema}."clientes" WHERE "id" = $1`, [
        cliente?.id,
      ]),
      '23503',
      'FK_reservaciones_cliente',
    );
    await expectFailure(
      dataSource.query(`DELETE FROM ${schema}."sucursales" WHERE "id" = $1`, [
        sucursalSoloReservacion?.id,
      ]),
      '23503',
      'FK_reservaciones_sucursal',
    );
    await expectFailure(
      dataSource.query(`DELETE FROM ${schema}."vestidos" WHERE "id" = $1`, [
        vestidoA?.id,
      ]),
      '23503',
      'FK_reservacion_vestidos_vestido',
    );
  });

  it('applies the pending migration idempotently to an existing tenant', async () => {
    const empresa = await empresasService.create({
      nombre: 'Reservaciones Existing',
      slug: slugs[1],
    });
    const schema = quoteTenantSchemaName(empresa.schemaName);

    await dataSource.query(`DROP TABLE ${schema}."reservacion_vestidos"`);
    await dataSource.query(`DROP TABLE ${schema}."reservaciones"`);
    await dataSource.query(
      `DELETE FROM ${schema}."tenant_migrations" WHERE "name" = $1`,
      ['CreateReservaciones1795215600000'],
    );

    await tenantMigrationService.ensureMigrations(empresa.schemaName);
    await tenantMigrationService.ensureMigrations(empresa.schemaName);

    const tables = (await dataSource.query(
      `SELECT table_name AS "tableName" FROM information_schema.tables WHERE table_schema = $1 AND table_name IN ('reservaciones', 'reservacion_vestidos') ORDER BY table_name`,
      [empresa.schemaName],
    )) as Array<{ tableName: string }>;
    expect(tables).toEqual([
      { tableName: 'reservacion_vestidos' },
      { tableName: 'reservaciones' },
    ]);
    const migrations = (await dataSource.query(
      `SELECT "name" FROM ${schema}."tenant_migrations" WHERE "name" = $1`,
      ['CreateReservaciones1795215600000'],
    )) as Array<{ name: string }>;
    expect(migrations).toEqual([{ name: 'CreateReservaciones1795215600000' }]);
  });
});

async function expectFailure(
  operation: Promise<unknown>,
  code: string,
  constraint: string,
): Promise<void> {
  try {
    await operation;
    throw new Error(`Expected PostgreSQL error ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(QueryFailedError);
    expect(
      (error as QueryFailedError & { driverError: unknown }).driverError,
    ).toMatchObject({ code, constraint });
  }
}
