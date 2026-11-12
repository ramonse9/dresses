import { RefreshTokenService } from './refresh-token.service.js';

describe('RefreshTokenService', () => {
  const service = new RefreshTokenService();

  it('issues random opaque tokens and returns only their deterministic hash', () => {
    const first = service.issue();
    const second = service.issue();

    expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.hash).toBe(service.hash(first.token));
    expect(second.token).not.toBe(first.token);
    expect(first.hash).not.toContain(first.token);
  });
});
