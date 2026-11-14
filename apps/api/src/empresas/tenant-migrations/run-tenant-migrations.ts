import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module.js';
import { TenantMigrationService } from './tenant-migration.service.js';

async function run(): Promise<void> {
  const application = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const migrationService = application.get(TenantMigrationService);
    const migratedTenants = await migrationService.migrateAllTenants();
    process.stdout.write(
      `Tenant migrations applied to ${migratedTenants} schema(s).\n`,
    );
  } finally {
    await application.close();
  }
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  process.stderr.write(`Tenant migration failed: ${message}\n`);
  process.exitCode = 1;
});
