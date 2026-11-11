import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSourceOptions } from 'typeorm';

type EnvironmentReader = (key: string) => string | undefined;

const requiredVariables = [
  'DB_HOST',
  'DB_PORT',
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_DATABASE',
] as const;

function requiredValue(
  readEnvironment: EnvironmentReader,
  key: string,
): string {
  const value = readEnvironment(key);

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function parsePort(value: string): number {
  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('DB_PORT must be an integer between 1 and 65535');
  }

  return port;
}

function parseBoolean(value: string | undefined): boolean {
  return value?.toLowerCase() === 'true';
}

export function createDataSourceOptions(
  readEnvironment: EnvironmentReader = (key) => process.env[key],
): DataSourceOptions {
  const database = requiredValue(readEnvironment, 'DB_DATABASE');

  if (database !== 'vestidos_saas') {
    throw new Error('DB_DATABASE must be vestidos_saas');
  }

  return {
    type: 'postgres',
    host: requiredValue(readEnvironment, 'DB_HOST'),
    port: parsePort(requiredValue(readEnvironment, 'DB_PORT')),
    username: requiredValue(readEnvironment, 'DB_USERNAME'),
    password: requiredValue(readEnvironment, 'DB_PASSWORD'),
    database,
    ssl: parseBoolean(readEnvironment('DB_SSL')),
    entities: [`${import.meta.dirname}/../**/*.entity.{ts,js}`],
    migrations: [`${import.meta.dirname}/migrations/*.{ts,js}`],
    migrationsTableName: 'typeorm_migrations',
    synchronize: false,
    migrationsRun: false,
  };
}

export function createTypeOrmOptions(
  configService: ConfigService,
): TypeOrmModuleOptions {
  return {
    ...createDataSourceOptions((key) => configService.get<string>(key)),
    retryAttempts: 3,
    retryDelay: 1_000,
  };
}

export function validateDatabaseEnvironment(
  environment: Record<string, unknown>,
): Record<string, unknown> {
  for (const variable of requiredVariables) {
    const value = environment[variable];

    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(`Missing required environment variable: ${variable}`);
    }
  }

  createDataSourceOptions((key) => {
    const value = environment[key];
    return typeof value === 'string' ? value : undefined;
  });

  return environment;
}
