import { PasswordHashService } from './password-hash.service.js';

describe('PasswordHashService', () => {
  const service = new PasswordHashService();

  it('hashes and verifies passwords with Argon2id', async () => {
    const password = 'a-strong-local-password';
    const passwordHash = await service.hashPassword(password);

    expect(passwordHash).not.toBe(password);
    expect(passwordHash).toMatch(/^\$argon2id\$/);
    await expect(service.verifyPassword(password, passwordHash)).resolves.toBe(
      true,
    );
  });

  it('rejects an incorrect password', async () => {
    const passwordHash = await service.hashPassword('correct-password');

    await expect(
      service.verifyPassword('incorrect-password', passwordHash),
    ).resolves.toBe(false);
  });

  it('performs a safe comparison when no user hash exists', async () => {
    await expect(
      service.verifyPassword('unknown-password', undefined),
    ).resolves.toBe(false);
  });
});
