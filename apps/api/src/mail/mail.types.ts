export type TransactionalMail = {
  readonly recipient: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
};

export type TransportMailMessage = {
  readonly from: string;
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
};

export interface MailTransport {
  send(message: TransportMailMessage): Promise<void>;
}

export interface SmtpClient {
  sendMail(message: TransportMailMessage): Promise<unknown>;
}
