import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, QueryFailedError } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { Empresa } from '../src/empresas/entities/empresa.entity.js';
import { EmpresasService } from '../src/empresas/empresas.service.js';
import { quoteTenantSchemaName } from '../src/empresas/tenant-schema-name.js';
import { TenantMigrationService } from '../src/empresas/tenant-migrations/tenant-migration.service.js';
import { SucursalesService } from '../src/sucursales/sucursales.service.js';
import { TenantResolverService } from '../src/tenancy/tenant-resolver.service.js';

describe('PostgreSQL vestidos tenant migration', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let empresasService: EmpresasService;
  let sucursalesService: SucursalesService;
  let tenantResolver: TenantResolverService;
  let tenantMigrationService: TenantMigrationService;

  const suffix = `${process.pid}-${Date.now()}`;
  const slugs = [`vestidos-new-${suffix}`, `vestidos-existing-${suffix}`];

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await moduleRef.init();

    dataSource = moduleRef.get(DataSource);
    empresasService = moduleRef.get(EmpresasService);
    sucursalesService = moduleRef.get(SucursalesService);
    tenantResolver = moduleRef.get(TenantResolverService);
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

  it('provisions vestidos with constraints for a new tenant', async () => {
    const empresa = await empresasService.create({
      nombre: 'Vestidos New',
      slug: slugs[0],
    });
    const tenant = await tenantResolver.resolveByEmpresaId(empresa.id);
    const sucursal = await sucursalesService.create(tenant, {
      nombre: 'Centro',
    });
    const schemaIdentifier = quoteTenantSchemaName(empresa.schemaName);

    const columns = (await dataSource.query(
      `SELECT column_name AS "columnName", data_type AS "dataType", numeric_precision AS "precision", numeric_scale AS "scale" FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'vestidos' ORDER BY ordinal_position`,
      [empresa.schemaName],
    )) as Array<{
      columnName: string;
      dataType: string;
      precision: number | null;
      scale: number | null;
    }>;
    expect(columns.map(({ columnName }) => columnName)).toEqual([
      'id',
      'sucursal_id',
      'codigo',
      'nombre',
      'descripcion',
      'talla',
      'color',
      'marca',
      'precio_renta',
      'deposito',
      'estado_operativo',
      'activo',
      'created_at',
      'updated_at',
    ]);
    expect(
      columns.find(({ columnName }) => columnName === 'precio_renta'),
    ).toMatchObject({
      dataType: 'numeric',
      precision: 12,
      scale: 2,
    });
    expect(
      columns.find(({ columnName }) => columnName === 'deposito'),
    ).toMatchObject({
      dataType: 'numeric',
      precision: 12,
      scale: 2,
    });

    const migrations = (await dataSource.query(
      `SELECT "name" FROM ${schemaIdentifier}."tenant_migrations" WHERE "name" = $1`,
      ['CreateVestidos1794697200000'],
    )) as Array<{ name: string }>;
    expect(migrations).toEqual([{ name: 'CreateVestidos1794697200000' }]);

    const indexes = (await dataSource.query(
      `SELECT indexname AS "indexName" FROM pg_indexes WHERE schemaname = $1 AND tablename = 'vestidos' ORDER BY indexname`,
      [empresa.schemaName],
    )) as Array<{ indexName: string }>;
    expect(indexes.map(({ indexName }) => indexName)).toEqual([
      'IDX_vestidos_activo',
      'IDX_vestidos_sucursal_id',
      'PK_vestidos_id',
      'UQ_vestidos_codigo_normalized',
    ]);

    await dataSource.query(
      `INSERT INTO ${schemaIdentifier}."vestidos" ("sucursal_id", "codigo", "nombre", "talla", "color", "precio_renta", "deposito") VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [sucursal.id, 'V-001', 'Vestido Azul', 'M', 'Azul', '1250.50', '500.00'],
    );

    await expectQueryFailure(
      dataSource.query(
        `INSERT INTO ${schemaIdentifier}."vestidos" ("sucursal_id", "codigo", "nombre", "talla", "color", "precio_renta") VALUES ($1, $2, $3, $4, $5, $6)`,
        [sucursal.id, 'v-001', 'Duplicado', 'M', 'Azul', '100.00'],
      ),
      '23505',
      'UQ_vestidos_codigo_normalized',
    );
    await expectQueryFailure(
      dataSource.query(
        `INSERT INTO ${schemaIdentifier}."vestidos" ("sucursal_id", "codigo", "nombre", "talla", "color", "precio_renta", "estado_operativo") VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          sucursal.id,
          'V-002',
          'Estado inválido',
          'M',
          'Rojo',
          '100.00',
          'RENTADO',
        ],
      ),
      '23514',
      'CHK_vestidos_estado_operativo',
    );
    await expectQueryFailure(
      dataSource.query(
        `INSERT INTO ${schemaIdentifier}."vestidos" ("sucursal_id", "codigo", "nombre", "talla", "color", "precio_renta") VALUES ($1, $2, $3, $4, $5, $6)`,
        [sucursal.id, 'V-003', 'Precio inválido', 'M', 'Verde', '-1.00'],
      ),
      '23514',
      'CHK_vestidos_precio_renta',
    );
    await expectQueryFailure(
      dataSource.query(
        `INSERT INTO ${schemaIdentifier}."vestidos" ("sucursal_id", "codigo", "nombre", "talla", "color", "precio_renta", "deposito") VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          sucursal.id,
          'V-004',
          'Depósito inválido',
          'M',
          'Negro',
          '100.00',
          '-1.00',
        ],
      ),
      '23514',
      'CHK_vestidos_deposito',
    );
    await expectQueryFailure(
      dataSource.query(
        `INSERT INTO ${schemaIdentifier}."vestidos" ("sucursal_id", "codigo", "nombre", "talla", "color", "precio_renta") VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          '00000000-0000-4000-8000-000000000000',
          'V-005',
          'Sucursal inválida',
          'M',
          'Blanco',
          '100.00',
        ],
      ),
      '23503',
      'FK_vestidos_sucursal',
    );
    await expectQueryFailure(
      dataSource.query(
        `DELETE FROM ${schemaIdentifier}."sucursales" WHERE "id" = $1`,
        [sucursal.id],
      ),
      '23503',
      'FK_vestidos_sucursal',
    );
  });

  it('applies the pending migration to an existing tenant schema', async () => {
    const empresa = await empresasService.create({
      nombre: 'Vestidos Existing',
      slug: slugs[1],
    });
    const schemaIdentifier = quoteTenantSchemaName(empresa.schemaName);

    await dataSource.query(`DROP TABLE ${schemaIdentifier}."vestidos"`);
    await dataSource.query(
      `DELETE FROM ${schemaIdentifier}."tenant_migrations" WHERE "name" = $1`,
      ['CreateVestidos1794697200000'],
    );

    await tenantMigrationService.ensureMigrations(empresa.schemaName);

    const tables = (await dataSource.query(
      `SELECT table_name AS "tableName" FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'vestidos'`,
      [empresa.schemaName],
    )) as Array<{ tableName: string }>;
    expect(tables).toEqual([{ tableName: 'vestidos' }]);

    await tenantMigrationService.ensureMigrations(empresa.schemaName);
    const migrationRows = (await dataSource.query(
      `SELECT "name" FROM ${schemaIdentifier}."tenant_migrations" WHERE "name" = $1`,
      ['CreateVestidos1794697200000'],
    )) as Array<{ name: string }>;
    expect(migrationRows).toEqual([{ name: 'CreateVestidos1794697200000' }]);
  });
});

async function expectQueryFailure(
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
    ).toMatchObject({
      code,
      constraint,
    });
  }
}
