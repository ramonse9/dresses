import {
  createDataSourceOptions,
  validateDatabaseEnvironment,
} from './database.config.js';

const environment = {
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_USERNAME: 'postgres',
  DB_PASSWORD: 'test-only',
  DB_DATABASE: 'vestidos_saas',
  DB_SSL: 'false',
};

describe('database configuration', () => {
  it('creates PostgreSQL options with migrations and synchronization disabled', () => {
    const options = createDataSourceOptions(
      (key) => environment[key as keyof typeof environment],
    );

    expect(options).toMatchObject({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      database: 'vestidos_saas',
      migrationsTableName: 'typeorm_migrations',
      synchronize: false,
      migrationsRun: false,
    });
    expect(options.migrations).toHaveLength(1);
  });

  it('rejects a different database name', () => {
    expect(() =>
      validateDatabaseEnvironment({
        ...environment,
        DB_DATABASE: 'another_database',
      }),
    ).toThrow('DB_DATABASE must be vestidos_saas');
  });
});
