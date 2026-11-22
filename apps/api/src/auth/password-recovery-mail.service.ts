import { Injectable } from '@nestjs/common';
import { MailDeliveryError } from '../mail/mail.errors.js';
import { escapeMailHtml } from '../mail/mail-html.js';
import { TransactionalMailService } from '../mail/transactional-mail.service.js';

export type PasswordRecoveryMailInput = Readonly<{
  recipient: string;
  url: string;
}>;

@Injectable()
export class PasswordRecoveryMailService {
  constructor(private readonly mailService: TransactionalMailService) {}

  async send(input: PasswordRecoveryMailInput): Promise<void> {
    const url = escapeMailHtml(input.url);
    try {
      await this.mailService.send({
        recipient: input.recipient,
        subject: 'Restablece tu contraseña de Vestidos SaaS',
        text: `Recibimos una solicitud para restablecer tu contraseña. Abre este enlace: ${input.url}`,
        html: `<p>Recibimos una solicitud para restablecer tu contraseña.</p><p><a href="${url}">Restablecer contraseña</a></p>`,
      });
    } catch {
      throw new MailDeliveryError();
    }
  }
}
