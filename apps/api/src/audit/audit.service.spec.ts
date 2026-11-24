import { DataSource, EntityManager, Repository } from 'typeorm';
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from './audit.constants.js';
import { AuditService } from './audit.service.js';
import { AuditEvent } from './entities/audit-event.entity.js';

describe('AuditService', () => {
  const baseInput = {
    action: AUDIT_ACTIONS.AUTH_SESSION_REVOKED,
    resourceType: AUDIT_RESOURCE_TYPES.AUTH_SESSION,
  } as const;

  function managerFixture() {
    const create = vi.fn((input: Partial<AuditEvent>) =>
      Object.assign(new AuditEvent(), input),
    );
    const save = vi.fn(async (event: AuditEvent) =>
      Object.assign(event, {
        id: '11111111-1111-4111-8111-111111111111',
        createdAt: new Date('2026-11-23T12:00:00.000Z'),
      }),
    );
    const repository = { create, save } as unknown as Repository<AuditEvent>;
    const getRepository = vi.fn().mockReturnValue(repository);
    const manager = { getRepository } as unknown as EntityManager;
    return { create, save, getRepository, manager };
  }

  it('records a global event in its own transaction when no manager exists', async () => {
    const fixture = managerFixture();
    const transaction = vi.fn((operation) => operation(fixture.manager));
    const service = new AuditService({ transaction } as unknown as DataSource);

    const result = await service.record({
      ...baseInput,
      actorUsuarioId: '33333333-3333-4333-8333-333333333333',
      metadata: { current: true },
      safeMetadataFields: ['current'],
    });

    expect(transaction).toHaveBeenCalledOnce();
    expect(fixture.getRepository).toHaveBeenCalledWith(AuditEvent);
    expect(fixture.create).toHaveBeenCalledWith(
      expect.objectContaining({
        empresaId: null,
        metadata: { current: true },
      }),
    );
    expect(result.id).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('reuses an existing transaction manager for an event associated with a company', async () => {
    const fixture = managerFixture();
    const transaction = vi.fn();
    const service = new AuditService({ transaction } as unknown as DataSource);

    await service.record(
      {
        ...baseInput,
        empresaId: '22222222-2222-4222-8222-222222222222',
      },
      fixture.manager,
    );

    expect(transaction).not.toHaveBeenCalled();
    expect(fixture.save).toHaveBeenCalledOnce();
    expect(fixture.create).toHaveBeenCalledWith(
      expect.objectContaining({
        empresaId: '22222222-2222-4222-8222-222222222222',
      }),
    );
  });

  it('redacts secrets and bounds user-agent before persistence', async () => {
    const fixture = managerFixture();
    const service = new AuditService({} as DataSource);

    await service.record(
      {
        ...baseInput,
        metadata: {
          reason: 'remote-revocation',
          passwordHash: 'secret-hash',
          nested: { schemaName: 'tenant_secret', safe: true },
        },
        safeMetadataFields: ['reason', 'passwordHash', 'nested'],
        userAgent: `  Browser/${'x'.repeat(600)}  `,
      },
      fixture.manager,
    );

    const persisted = fixture.create.mock.calls[0]?.[0] as Partial<AuditEvent>;
    expect(persisted.metadata).toEqual({
      reason: 'remote-revocation',
      nested: { safe: true },
    });
    expect(persisted.userAgent).toHaveLength(512);
    expect(JSON.stringify(persisted)).not.toMatch(
      /secret-hash|schemaName|tenant_secret/,
    );
  });

  it('propagates persistence failures to the transaction owner', async () => {
    const fixture = managerFixture();
    fixture.save.mockRejectedValueOnce(new Error('transaction failed'));
    const transaction = vi.fn();
    const service = new AuditService({ transaction } as unknown as DataSource);

    await expect(service.record(baseInput, fixture.manager)).rejects.toThrow(
      'transaction failed',
    );
    expect(transaction).not.toHaveBeenCalled();
  });
});
