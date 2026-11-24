import { buildAuditMetadata } from './audit-metadata.js';

describe('buildAuditMetadata', () => {
  it('copies only explicitly allowed safe fields', () => {
    expect(
      buildAuditMetadata(
        {
          previousRole: 'EMPLOYEE',
          nextRole: 'OWNER',
          ignored: 'must-not-be-recorded',
        },
        ['previousRole', 'nextRole'],
      ),
    ).toEqual({ previousRole: 'EMPLOYEE', nextRole: 'OWNER' });
  });

  it('removes sensitive fields even when allowlisted or nested', () => {
    const metadata = buildAuditMetadata(
      {
        email: 'member@example.test',
        password: 'plain-secret',
        tokenHash: 'hashed-secret',
        schemaName: 'tenant_should_not_appear',
        change: {
          status: 'active',
          refresh_token: 'refresh-secret',
          Authorization: 'Bearer secret',
          nested: [{ cookie: 'secret-cookie', safe: true }],
        },
      },
      ['email', 'password', 'tokenHash', 'schemaName', 'change'],
    );

    expect(metadata).toEqual({
      email: 'member@example.test',
      change: { status: 'active', nested: [{ safe: true }] },
    });
    expect(JSON.stringify(metadata)).not.toMatch(
      /plain-secret|hashed-secret|refresh-secret|secret-cookie|authorization|schemaName|tenant_/i,
    );
  });

  it('keeps only JSON-safe values', () => {
    expect(
      buildAuditMetadata(
        {
          date: new Date('2026-11-23T12:00:00.000Z'),
          finite: 10,
          invalid: Number.NaN,
          callback: () => undefined,
          list: [1, undefined, 'safe'],
        },
        ['date', 'finite', 'invalid', 'callback', 'list'],
      ),
    ).toEqual({
      date: '2026-11-23T12:00:00.000Z',
      finite: 10,
      list: [1, 'safe'],
    });
  });
});
