import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, QueryFailedError } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { Empresa } from '../src/empresas/entities/empresa.entity.js';
import { EmpresasService } from '../src/empresas/empresas.service.js';
import { quoteTenantSchemaName } from '../src/empresas/tenant-schema-name.js';
import { TenantMigrationService } from '../src/empresas/tenant-migrations/tenant-migration.service.js';

describe('PostgreSQL clientes tenant migration', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let empresasService: EmpresasService;
  let tenantMigrationService: TenantMigrationService;

  const suffix = `${process.pid}-${Date.now()}`;
  const slugs = [`clientes-new-${suffix}`, `clientes-existing-${suffix}`];

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

  it('provisions normalized clientes only inside a new tenant', async () => {
    const empresa = await empresasService.create({
      nombre: 'Clientes New',
      slug: slugs[0],
    });
    const schemaIdentifier = quoteTenantSchemaName(empresa.schemaName);

    const columns = (await dataSource.query(
      `SELECT column_name AS "columnName", character_maximum_length AS "maximumLength", is_nullable AS "isNullable" FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'clientes' ORDER BY ordinal_position`,
      [empresa.schemaName],
    )) as Array<{
      columnName: string;
      maximumLength: number | null;
      isNullable: 'YES' | 'NO';
    }>;
    expect(columns.map(({ columnName }) => columnName)).toEqual([
      'id',
      'nombre',
      'telefono',
      'email',
      'direccion',
      'notas',
      'activo',
      'created_at',
      'updated_at',
    ]);
    expect(columns.find(({ columnName }) => columnName === 'nombre')).toEqual(
      expect.objectContaining({ maximumLength: 160, isNullable: 'NO' }),
    );
    expect(columns.find(({ columnName }) => columnName === 'telefono')).toEqual(
      expect.objectContaining({ maximumLength: 40, isNullable: 'YES' }),
    );
    expect(columns.find(({ columnName }) => columnName === 'email')).toEqual(
      expect.objectContaining({ maximumLength: 254, isNullable: 'YES' }),
    );
    expect(
      columns.find(({ columnName }) => columnName === 'direccion'),
    ).toEqual(
      expect.objectContaining({ maximumLength: 255, isNullable: 'YES' }),
    );
    expect(columns.find(({ columnName }) => columnName === 'notas')).toEqual(
      expect.objectContaining({ maximumLength: 2_000, isNullable: 'YES' }),
    );

    const publicTable = (await dataSource.query(
      `SELECT to_regclass('public.clientes') AS "tableName"`,
    )) as Array<{ tableName: string | null }>;
    expect(publicTable).toEqual([{ tableName: null }]);

    const migrationRows = (await dataSource.query(
      `SELECT "name" FROM ${schemaIdentifier}."tenant_migrations" WHERE "name" = $1`,
      ['CreateClientes1794956400000'],
    )) as Array<{ name: string }>;
    expect(migrationRows).toEqual([{ name: 'CreateClientes1794956400000' }]);

    const indexes = (await dataSource.query(
      `SELECT indexname AS "indexName", indexdef AS "indexDefinition" FROM pg_indexes WHERE schemaname = $1 AND tablename = 'clientes' ORDER BY indexname`,
      [empresa.schemaName],
    )) as Array<{ indexName: string; indexDefinition: string }>;
    expect(indexes.map(({ indexName }) => indexName)).toEqual([
      'IDX_clientes_activo_created_at',
      'IDX_clientes_email_normalized',
      'IDX_clientes_nombre_normalized',
      'IDX_clientes_telefono',
      'PK_clientes_id',
    ]);
    expect(
      indexes
        .filter(({ indexName }) => indexName.startsWith('IDX_clientes_'))
        .every(({ indexDefinition }) => !indexDefinition.includes('UNIQUE')),
    ).toBe(true);
    expect(
      indexes.find(
        ({ indexName }) => indexName === 'IDX_clientes_activo_created_at',
      )?.indexDefinition,
    ).toContain('(activo, created_at, id)');
    expect(
      indexes.find(
        ({ indexName }) => indexName === 'IDX_clientes_nombre_normalized',
      )?.indexDefinition,
    ).toContain('lower((nombre)::text)');

    await dataSource.query(
      `INSERT INTO ${schemaIdentifier}."clientes" ("nombre", "email") VALUES ($1, $2), ($3, $4)`,
      [
        'Ana López',
        'shared@example.com',
        'Beatriz López',
        'shared@example.com',
      ],
    );
    await dataSource.query(
      `INSERT INTO ${schemaIdentifier}."clientes" ("nombre", "telefono") VALUES ($1, $2), ($3, $4)`,
      ['Carla Ruiz', '555-0100', 'Daniel Ruiz', '555-0100'],
    );
    const count = (await dataSource.query(
      `SELECT COUNT(*)::integer AS "count" FROM ${schemaIdentifier}."clientes"`,
    )) as Array<{ count: number }>;
    expect(count).toEqual([{ count: 4 }]);

    await expectCheckFailure(
      dataSource.query(
        `INSERT INTO ${schemaIdentifier}."clientes" ("nombre") VALUES ($1)`,
        ['Sin contacto'],
      ),
      'CHK_clientes_contacto_requerido',
    );
    await expectCheckFailure(
      dataSource.query(
        `INSERT INTO ${schemaIdentifier}."clientes" ("nombre", "telefono") VALUES ($1, $2)`,
        ['   ', '555-0200'],
      ),
      'CHK_clientes_nombre_normalized',
    );
    await expectCheckFailure(
      dataSource.query(
        `INSERT INTO ${schemaIdentifier}."clientes" ("nombre", "email") VALUES ($1, $2)`,
        ['Email sin normalizar', 'UPPER@EXAMPLE.COM'],
      ),
      'CHK_clientes_email_normalized',
    );
  });

  it('applies the pending migration to an existing tenant schema', async () => {
    const empresa = await empresasService.create({
      nombre: 'Clientes Existing',
      slug: slugs[1],
    });
    const schemaIdentifier = quoteTenantSchemaName(empresa.schemaName);

    await dataSource.query(`DROP TABLE ${schemaIdentifier}."clientes"`);
    await dataSource.query(
      `DELETE FROM ${schemaIdentifier}."tenant_migrations" WHERE "name" = $1`,
      ['CreateClientes1794956400000'],
    );

    await tenantMigrationService.ensureMigrations(empresa.schemaName);
    await tenantMigrationService.ensureMigrations(empresa.schemaName);

    const tables = (await dataSource.query(
      `SELECT table_name AS "tableName" FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'clientes'`,
      [empresa.schemaName],
    )) as Array<{ tableName: string }>;
    expect(tables).toEqual([{ tableName: 'clientes' }]);

    const migrations = (await dataSource.query(
      `SELECT "name" FROM ${schemaIdentifier}."tenant_migrations" WHERE "name" = $1`,
      ['CreateClientes1794956400000'],
    )) as Array<{ name: string }>;
    expect(migrations).toEqual([{ name: 'CreateClientes1794956400000' }]);
  });
});

async function expectCheckFailure(
  operation: Promise<unknown>,
  constraint: string,
): Promise<void> {
  try {
    await operation;
    throw new Error(`Expected PostgreSQL constraint ${constraint}`);
  } catch (error) {
    expect(error).toBeInstanceOf(QueryFailedError);
    expect(
      (error as QueryFailedError & { driverError: unknown }).driverError,
    ).toMatchObject({ code: '23514', constraint });
  }
}
