import { QueryRunner } from 'typeorm';
import { AddAuthSessionMetadata1795734000000 } from './migrations/1795734000000-AddAuthSessionMetadata.js';

describe('AddAuthSessionMetadata1795734000000', () => {
  it('adds bounded metadata, compatible backfill, indexes and actor relation', async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    const migration = new AddAuthSessionMetadata1795734000000();

    await migration.up({ query } as unknown as QueryRunner);

    const sql = query.mock.calls.flat().join('\n');
    expect(sql).toContain('ADD "ip_address" inet');
    expect(sql).toContain('ADD "user_agent" character varying(512)');
    expect(sql).toContain('ADD "last_seen_at" TIMESTAMP WITH TIME ZONE');
    expect(sql).toContain('COALESCE("updated_at", "created_at", now())');
    expect(sql).toContain('ALTER COLUMN "last_seen_at" SET NOT NULL');
    expect(sql).toContain('"IDX_auth_sessions_usuario_revoked_at"');
    expect(sql).toContain('"IDX_auth_sessions_usuario_last_seen_at"');
    expect(sql).toContain('"FK_auth_sessions_revoked_by_usuario"');
    expect(sql).toContain('ON DELETE SET NULL');
  });

  it('removes metadata structures in dependency-safe order', async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    const migration = new AddAuthSessionMetadata1795734000000();

    await migration.down({ query } as unknown as QueryRunner);

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('DROP CONSTRAINT'),
    );
    expect(query).toHaveBeenLastCalledWith(
      'ALTER TABLE "public"."auth_sessions" DROP COLUMN "ip_address"',
    );
  });
});
