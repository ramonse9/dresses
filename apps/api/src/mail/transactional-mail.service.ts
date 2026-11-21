import { Inject, Injectable } from '@nestjs/common';
import type { MailConfiguration } from './mail.config.js';
import { MAIL_CONFIGURATION, MAIL_TRANSPORT } from './mail.tokens.js';
import type { MailTransport, TransactionalMail } from './mail.types.js';

@Injectable()
export class TransactionalMailService {
  constructor(
    @Inject(MAIL_CONFIGURATION)
    private readonly configuration: MailConfiguration,
    @Inject(MAIL_TRANSPORT) private readonly transport: MailTransport,
  ) {}

  send(message: TransactionalMail): Promise<void> {
    return this.transport.send({
      from: this.configuration.mode === 'smtp' ? this.configuration.from : '',
      to: message.recipient,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }

  getWebAppOrigin(): string {
    return this.configuration.webAppUrl;
  }
}
