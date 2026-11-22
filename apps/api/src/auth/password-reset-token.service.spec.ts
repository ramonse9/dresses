import { createHash } from 'node:crypto';
import { TransactionalMailService } from '../mail/transactional-mail.service.js';
import { PasswordResetTokenService } from './password-reset-token.service.js';

describe('PasswordResetTokenService', () => {
  const service = new PasswordResetTokenService({
    getWebAppOrigin: vi.fn().mockReturnValue('https://app.example.test'),
  } as unknown as TransactionalMailService);

  it('generates at least 256 random bits and stores a SHA-256 representation', () => {
    const first = service.generate();
    const second = service.generate();

    expect(Buffer.from(first.token, 'base64url')).toHaveLength(32);
    expect(first.token).not.toBe(second.token);
    expect(first.hash).toBe(
      createHash('sha256').update(first.token, 'utf8').digest('hex'),
    );
    expect(first.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(first.hash).not.toContain(first.token);
  });

  it('builds only the internal fragment-based reset URL', () => {
    const url = service.buildResetUrl('safe_token-value');

    expect(url).toBe(
      'https://app.example.test/restablecer-password#token=safe_token-value',
    );
    expect(new URL(url).search).toBe('');
    expect(new URL(url).hash).toBe('#token=safe_token-value');
  });
});
