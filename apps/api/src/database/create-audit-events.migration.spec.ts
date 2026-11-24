import { QueryRunner } from 'typeorm';
import { CreateAuditEvents1795820400000 } from './migrations/1795820400000-CreateAuditEvents.js';

describe('CreateAuditEvents1795820400000', () => {
  it('creates the immutable public table with constraints and lookup indexes', async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    const migration = new CreateAuditEvents1795820400000();

    await migration.up({ query } as unknown as QueryRunner);

    const sql = query.mock.calls.flat().join('\n');
    expect(sql).toContain('"public"."audit_events"');
    expect(sql).toContain('"metadata" jsonb NOT NULL');
    expect(sql).toContain('"ip_address" inet');
    expect(sql).toContain('"user_agent" character varying(512)');
    expect(sql).toContain('"IDX_audit_events_empresa_created_at_id"');
    expect(sql).toContain('"IDX_audit_events_actor_created_at"');
    expect(sql).toContain('"IDX_audit_events_resource_created_at"');
    expect(sql).toContain('"IDX_audit_events_action_created_at"');
    expect(sql).toContain('"TRG_audit_events_immutable"');
    expect(sql).toContain("ERRCODE = '55000'");
    expect(sql).not.toContain('schema_name');
  });

  it('drops the trigger and function before the audit table', async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    const migration = new CreateAuditEvents1795820400000();

    await migration.down({ query } as unknown as QueryRunner);

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('DROP TRIGGER'),
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('DROP FUNCTION'),
    );
    expect(query).toHaveBeenLastCalledWith(
      'DROP TABLE "public"."audit_events"',
    );
  });
});
