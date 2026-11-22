import { MailDeliveryError } from '../mail/mail.errors.js';
import { TransactionalMailService } from '../mail/transactional-mail.service.js';
import { PasswordRecoveryMailService } from './password-recovery-mail.service.js';

describe('PasswordRecoveryMailService', () => {
  it('sends an internal escaped template', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const service = new PasswordRecoveryMailService({
      send,
    } as unknown as TransactionalMailService);

    await service.send({
      recipient: 'person@example.com',
      url: 'https://app.example.test/restablecer-password#token=a&b',
    });

    expect(send).toHaveBeenCalledWith({
      recipient: 'person@example.com',
      subject: 'Restablece tu contraseña de Vestidos SaaS',
      text: expect.stringContaining('#token=a&b'),
      html: expect.stringContaining('#token=a&amp;b'),
    });
  });

  it('wraps provider errors without exposing their secret-bearing message', async () => {
    const token = 'never-expose-this-token';
    const service = new PasswordRecoveryMailService({
      send: vi.fn().mockRejectedValue(new Error(`SMTP failure ${token}`)),
    } as unknown as TransactionalMailService);

    let received: unknown;
    try {
      await service.send({
        recipient: 'person@example.com',
        url: `https://app.example.test/restablecer-password#token=${token}`,
      });
    } catch (error) {
      received = error;
    }

    expect(received).toBeInstanceOf(MailDeliveryError);
    expect(String(received)).not.toContain(token);
  });
});
