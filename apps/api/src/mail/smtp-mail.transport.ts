import { Inject, Injectable } from '@nestjs/common';
import { MailDeliveryError } from './mail.errors.js';
import { SMTP_CLIENT } from './mail.tokens.js';
import type {
  MailTransport,
  SmtpClient,
  TransportMailMessage,
} from './mail.types.js';

@Injectable()
export class SmtpMailTransport implements MailTransport {
  constructor(
    @Inject(SMTP_CLIENT) private readonly client: SmtpClient | null,
  ) {}

  async send(message: TransportMailMessage): Promise<void> {
    if (!this.client) {
      throw new MailDeliveryError();
    }

    try {
      await this.client.sendMail(message);
    } catch {
      throw new MailDeliveryError();
    }
  }
}
