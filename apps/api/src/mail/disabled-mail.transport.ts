import { Injectable } from '@nestjs/common';
import { MailDisabledError } from './mail.errors.js';
import type { MailTransport, TransportMailMessage } from './mail.types.js';

@Injectable()
export class DisabledMailTransport implements MailTransport {
  send(_message: TransportMailMessage): Promise<void> {
    return Promise.reject(new MailDisabledError());
  }
}
