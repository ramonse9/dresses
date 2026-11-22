import { QueryRunner } from 'typeorm';
import { CreateEmpresaInvitaciones1795561200000 } from './migrations/1795561200000-CreateEmpresaInvitaciones.js';

describe('CreateEmpresaInvitaciones1795561200000', () => {
  it('creates the public invitation table, constraints, indexes and relations', async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    const migration = new CreateEmpresaInvitaciones1795561200000();

    await migration.up({ query } as unknown as QueryRunner);

    const sql = query.mock.calls.flat().join('\n');
    expect(sql).toContain('"public"."empresa_invitaciones"');
    expect(sql).toContain('"token_hash" character varying(64)');
    expect(sql).toContain('"UQ_empresa_invitaciones_token_hash"');
    expect(sql).toContain('"UQ_empresa_invitaciones_pendiente_empresa_email"');
    expect(sql).toContain('"accepted_at" IS NULL');
    expect(sql).toContain('"revoked_at" IS NULL');
    expect(sql).toContain('"CHK_empresa_invitaciones_send_count"');
    expect(sql).toContain('REFERENCES "public"."empresas"("id")');
    expect(sql.match(/REFERENCES "public"\."usuarios"\("id"\)/g)).toHaveLength(
      2,
    );
    expect(sql.match(/ON DELETE RESTRICT/g)).toHaveLength(3);
  });

  it('drops invitation structures in dependency-safe order', async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    const migration = new CreateEmpresaInvitaciones1795561200000();

    await migration.down({ query } as unknown as QueryRunner);

    expect(query.mock.calls.slice(0, 3).flat().join('\n')).toContain(
      'DROP CONSTRAINT',
    );
    expect(query).toHaveBeenLastCalledWith(
      'DROP TABLE "public"."empresa_invitaciones"',
    );
  });
});
