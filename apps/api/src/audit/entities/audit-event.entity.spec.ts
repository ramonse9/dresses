import { getMetadataArgsStorage } from 'typeorm';
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from '../audit.constants.js';
import { AuditEvent } from './audit-event.entity.js';

describe('AuditEvent', () => {
  it('defines the global immutable event shape in public', () => {
    const metadata = getMetadataArgsStorage();
    const table = metadata.tables.find((entry) => entry.target === AuditEvent);
    const columns = metadata.columns.filter(
      (column) => column.target === AuditEvent,
    );
    const byName = (propertyName: string) =>
      columns.find((column) => column.propertyName === propertyName)?.options;

    expect(table).toMatchObject({ name: 'audit_events', schema: 'public' });
    expect(byName('empresaId')).toMatchObject({ type: 'uuid', nullable: true });
    expect(byName('actorUsuarioId')).toMatchObject({
      type: 'uuid',
      nullable: true,
    });
    expect(byName('sessionId')).toMatchObject({ type: 'uuid', nullable: true });
    expect(byName('action')).toMatchObject({ type: 'varchar', length: 120 });
    expect(byName('resourceType')).toMatchObject({
      type: 'varchar',
      length: 80,
    });
    expect(byName('resourceId')).toMatchObject({
      type: 'uuid',
      nullable: true,
    });
    expect(byName('metadata')).toMatchObject({ type: 'jsonb' });
    expect(byName('ipAddress')).toMatchObject({ type: 'inet', nullable: true });
    expect(byName('userAgent')).toMatchObject({
      type: 'varchar',
      length: 512,
      nullable: true,
    });
    expect(columns.map(({ propertyName }) => propertyName)).not.toContain(
      'updatedAt',
    );
  });

  it('defines every required lookup index', () => {
    const indexes = getMetadataArgsStorage().indices.filter(
      (index) => index.target === AuditEvent,
    );

    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'IDX_audit_events_empresa_created_at_id',
          columns: ['empresaId', 'createdAt', 'id'],
        }),
        expect.objectContaining({
          name: 'IDX_audit_events_actor_created_at',
          columns: ['actorUsuarioId', 'createdAt'],
        }),
        expect.objectContaining({
          name: 'IDX_audit_events_resource_created_at',
          columns: ['resourceType', 'resourceId', 'createdAt'],
        }),
        expect.objectContaining({
          name: 'IDX_audit_events_action_created_at',
          columns: ['action', 'createdAt'],
        }),
      ]),
    );
  });

  it('serializes only the declared safe event fields', () => {
    const event = Object.assign(new AuditEvent(), {
      id: '11111111-1111-4111-8111-111111111111',
      empresaId: '22222222-2222-4222-8222-222222222222',
      actorUsuarioId: '33333333-3333-4333-8333-333333333333',
      sessionId: null,
      action: AUDIT_ACTIONS.MEMBERSHIP_DEACTIVATED,
      resourceType: AUDIT_RESOURCE_TYPES.MEMBERSHIP,
      resourceId: '44444444-4444-4444-8444-444444444444',
      metadata: { active: false },
      ipAddress: '203.0.113.10',
      userAgent: 'Browser/1.0',
      createdAt: new Date('2026-11-23T12:00:00.000Z'),
    });

    const serialized = event.toJSON();

    expect(serialized).toEqual(
      expect.objectContaining({ metadata: { active: false } }),
    );
    expect(JSON.stringify(serialized)).not.toMatch(
      /password|tokenHash|refreshToken|cookie|authorization|schemaName|tenant_/i,
    );
  });
});
