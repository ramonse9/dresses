import { QueryRunner } from 'typeorm';
import { CreatePasswordResetTokens1795647600000 } from './migrations/1795647600000-CreatePasswordResetTokens.js';

describe('CreatePasswordResetTokens1795647600000', () => {
  it('creates the public token table, user timestamp, indexes and relation', async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    const migration = new CreatePasswordResetTokens1795647600000();

    await migration.up({ query } as unknown as QueryRunner);

    const sql = query.mock.calls.flat().join('\n');
    expect(sql).toContain('ADD "password_changed_at"');
    expect(sql).toContain('"public"."password_reset_tokens"');
    expect(sql).toContain('"token_hash" character varying(64)');
    expect(sql).toContain('"CHK_password_reset_tokens_token_hash"');
    expect(sql).toContain('"UQ_password_reset_tokens_token_hash"');
    expect(sql).toContain('"UQ_password_reset_tokens_pending_usuario"');
    expect(sql).toContain('"used_at" IS NULL');
    expect(sql).toContain('"revoked_at" IS NULL');
    expect(sql).toContain('REFERENCES "public"."usuarios"("id")');
    expect(sql).toContain('ON DELETE CASCADE');
  });

  it('drops token structures and password timestamp in dependency-safe order', async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    const migration = new CreatePasswordResetTokens1795647600000();

    await migration.down({ query } as unknown as QueryRunner);

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('DROP CONSTRAINT'),
    );
    expect(query.mock.calls.flat().join('\n')).toContain(
      'DROP TABLE "public"."password_reset_tokens"',
    );
    expect(query).toHaveBeenLastCalledWith(
      'ALTER TABLE "public"."usuarios" DROP COLUMN "password_changed_at"',
    );
  });
});
