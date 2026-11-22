import { MailDeliveryError } from '../mail/mail.errors.js';
import { TransactionalMailService } from '../mail/transactional-mail.service.js';
import { EmpresaUsuarioRol } from '../usuarios/entities/empresa-usuario.entity.js';
import { InvitacionMailService } from './invitacion-mail.service.js';

describe('InvitacionMailService', () => {
  it('sends an internal escaped template', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const service = new InvitacionMailService({
      send,
    } as unknown as TransactionalMailService);

    await service.send({
      recipient: 'person@example.com',
      empresaNombre: '<Atelier & Co>',
      rol: EmpresaUsuarioRol.EMPLOYEE,
      url: 'https://app.example.test/aceptar-invitacion#token=a&b',
    });

    expect(send).toHaveBeenCalledWith({
      recipient: 'person@example.com',
      subject: 'Invitación a Vestidos SaaS',
      text: expect.stringContaining(
        'https://app.example.test/aceptar-invitacion#token=a&b',
      ),
      html: expect.stringContaining('&lt;Atelier &amp; Co&gt;'),
    });
    expect(send.mock.calls[0][0].html).toContain('token=a&amp;b');
  });

  it('wraps provider failures without logging or exposing the token', async () => {
    const token = 'never-log-this-token';
    const consoleSpies = [
      vi.spyOn(console, 'log').mockImplementation(() => undefined),
      vi.spyOn(console, 'warn').mockImplementation(() => undefined),
      vi.spyOn(console, 'error').mockImplementation(() => undefined),
    ];
    const service = new InvitacionMailService({
      send: vi.fn().mockRejectedValue(new Error(`SMTP failed ${token}`)),
    } as unknown as TransactionalMailService);

    let received: unknown;
    try {
      await service.send({
        recipient: 'person@example.com',
        empresaNombre: 'Atelier',
        rol: EmpresaUsuarioRol.OWNER,
        url: `https://app.example.test/aceptar-invitacion#token=${token}`,
      });
    } catch (error) {
      received = error;
    }

    expect(received).toBeInstanceOf(MailDeliveryError);
    expect(String(received)).not.toContain(token);
    expect(consoleSpies.every((spy) => spy.mock.calls.length === 0)).toBe(true);
    consoleSpies.forEach((spy) => spy.mockRestore());
  });
});
