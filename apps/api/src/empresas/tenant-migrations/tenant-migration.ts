import { QueryRunner } from 'typeorm';

export interface TenantMigration {
  readonly name: string;
  up(queryRunner: QueryRunner, schemaName: string): Promise<void>;
}
