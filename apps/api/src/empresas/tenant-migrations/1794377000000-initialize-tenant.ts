import { QueryRunner } from 'typeorm';
import { TenantMigration } from './tenant-migration.js';

export class InitializeTenant1794377000000 implements TenantMigration {
  readonly name = 'InitializeTenant1794377000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('SELECT 1');
  }
}
