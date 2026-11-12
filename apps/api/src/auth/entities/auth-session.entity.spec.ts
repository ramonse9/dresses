import { AuthSession } from './auth-session.entity.js';

describe('AuthSession', () => {
  it('never serializes the refresh token hash', () => {
    const session = Object.assign(new AuthSession(), {
      id: '47ecf96a-8f2c-4e07-bd1f-93936f2cdb90',
      usuarioId: '019a6f33-82b7-7a22-971b-6a8d7c5e4f30',
      refreshTokenHash: 'a'.repeat(64),
      expiresAt: new Date('2026-12-12T00:00:00.000Z'),
      revokedAt: null,
      createdAt: new Date('2026-11-12T00:00:00.000Z'),
      updatedAt: new Date('2026-11-12T00:00:00.000Z'),
    });

    const serialized = session.toJSON();

    expect(serialized).not.toHaveProperty('refreshTokenHash');
    expect(JSON.stringify(serialized)).not.toContain(session.refreshTokenHash);
  });
});
