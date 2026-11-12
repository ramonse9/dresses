import { QueryRunner } from 'typeorm';
import { CreateAuthSessions1794528000000 } from './migrations/1794528000000-CreateAuthSessions.js';

describe('CreateAuthSessions1794528000000', () => {
  it('creates the public session table, indexes and user foreign key', async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    const migration = new CreateAuthSessions1794528000000();

    await migration.up({ query } as unknown as QueryRunner);

    const sql = query.mock.calls.flat().join('\n');
    expect(sql).toContain('"public"."auth_sessions"');
    expect(sql).toContain('"refresh_token_hash" character varying(64)');
    expect(sql).toContain('"revoked_at" TIMESTAMP WITH TIME ZONE');
    expect(sql).toContain('"UQ_auth_sessions_refresh_token_hash"');
    expect(sql).toContain('REFERENCES "public"."usuarios"("id")');
  });

  it('removes the auth session structures on rollback', async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    const migration = new CreateAuthSessions1794528000000();

    await migration.down({ query } as unknown as QueryRunner);

    expect(query).toHaveBeenLastCalledWith(
      'DROP TABLE "public"."auth_sessions"',
    );
  });
});
