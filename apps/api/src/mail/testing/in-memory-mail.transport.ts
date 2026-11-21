import type { MailTransport, TransportMailMessage } from '../mail.types.js';

export class InMemoryMailTransport implements MailTransport {
  readonly messages: TransportMailMessage[] = [];

  send(message: TransportMailMessage): Promise<void> {
    this.messages.push({ ...message });
    return Promise.resolve();
  }

  clear(): void {
    this.messages.length = 0;
  }
}
