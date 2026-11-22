import { createHash } from 'node:crypto';
import { TransactionalMailService } from '../mail/transactional-mail.service.js';
import { InvitacionTokenService } from './invitacion-token.service.js';

describe('InvitacionTokenService', () => {
  const mailService = {
    getWebAppOrigin: vi.fn().mockReturnValue('https://app.example.test'),
  } as unknown as TransactionalMailService;
  const service = new InvitacionTokenService(mailService);

  it('generates independent tokens with at least 256 bits and SHA-256 hashes', () => {
    const first = service.generate();
    const second = service.generate();

    expect(Buffer.from(first.token, 'base64url')).toHaveLength(32);
    expect(first.token).not.toBe(second.token);
    expect(first.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(first.hash).toBe(
      createHash('sha256').update(first.token, 'utf8').digest('hex'),
    );
    expect(first.hash).not.toContain(first.token);
  });

  it('builds only the internal fragment-based acceptance URL', () => {
    const token = 'safe_token-value';
    const url = service.buildAcceptanceUrl(token);

    expect(url).toBe(
      'https://app.example.test/aceptar-invitacion#token=safe_token-value',
    );
    expect(new URL(url).search).toBe('');
    expect(new URL(url).hash).toBe('#token=safe_token-value');
  });
});
