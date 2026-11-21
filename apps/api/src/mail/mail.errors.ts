export class MailDisabledError extends Error {
  readonly code = 'MAIL_DISABLED';

  constructor() {
    super('El envío de correo no está disponible');
    this.name = 'MailDisabledError';
  }
}

export class MailDeliveryError extends Error {
  readonly code = 'MAIL_DELIVERY_FAILED';

  constructor() {
    super('No fue posible entregar el correo transaccional');
    this.name = 'MailDeliveryError';
  }
}
