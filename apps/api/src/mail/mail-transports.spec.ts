import { DisabledMailTransport } from './disabled-mail.transport.js';
import { MailDeliveryError, MailDisabledError } from './mail.errors.js';
import { SmtpMailTransport } from './smtp-mail.transport.js';
import type { SmtpClient, TransportMailMessage } from './mail.types.js';

const message: TransportMailMessage = {
  from: 'no-reply@example.test',
  to: 'recipient@example.test',
  subject: 'Security link',
  text: 'https://app.example.test/action?token=secret-token',
  html: '<a href="https://app.example.test/action?token=secret-token">Open</a>',
};

describe('mail transports', () => {
  it('fails in a controlled way while disabled without printing mail content', async () => {
    const consoleSpies = [
      vi.spyOn(console, 'log').mockImplementation(() => undefined),
      vi.spyOn(console, 'warn').mockImplementation(() => undefined),
      vi.spyOn(console, 'error').mockImplementation(() => undefined),
    ];

    await expect(
      new DisabledMailTransport().send(message),
    ).rejects.toBeInstanceOf(MailDisabledError);
    expect(consoleSpies.every((spy) => spy.mock.calls.length === 0)).toBe(true);
    consoleSpies.forEach((spy) => spy.mockRestore());
  });

  it('delegates to the SMTP client', async () => {
    const sendMail = vi.fn().mockResolvedValue({ accepted: true });
    const client: SmtpClient = { sendMail };
    await new SmtpMailTransport(client).send(message);
    expect(sendMail).toHaveBeenCalledWith(message);
  });

  it('wraps provider failures without leaking provider secrets', async () => {
    const client: SmtpClient = {
      sendMail: vi
        .fn()
        .mockRejectedValue(
          new Error('smtp-password-secret token=secret-token'),
        ),
    };

    let received: unknown;
    try {
      await new SmtpMailTransport(client).send(message);
    } catch (error) {
      received = error;
    }

    expect(received).toBeInstanceOf(MailDeliveryError);
    expect(String(received)).not.toMatch(
      /smtp-password-secret|secret-token|recipient@example/,
    );
  });

  it('fails generically if an SMTP client is unavailable', async () => {
    await expect(
      new SmtpMailTransport(null).send(message),
    ).rejects.toBeInstanceOf(MailDeliveryError);
  });
});
