import { Injectable } from '@nestjs/common';
import { MailDeliveryError } from '../mail/mail.errors.js';
import { escapeMailHtml } from '../mail/mail-html.js';
import { TransactionalMailService } from '../mail/transactional-mail.service.js';
import type { EmpresaUsuarioRol } from '../usuarios/entities/empresa-usuario.entity.js';

export type InvitationMailInput = Readonly<{
  recipient: string;
  empresaNombre: string;
  rol: EmpresaUsuarioRol;
  url: string;
}>;

@Injectable()
export class InvitacionMailService {
  constructor(private readonly mailService: TransactionalMailService) {}

  async send(input: InvitationMailInput): Promise<void> {
    const empresa = escapeMailHtml(input.empresaNombre);
    const rol = escapeMailHtml(input.rol);
    const url = escapeMailHtml(input.url);

    try {
      await this.mailService.send({
        recipient: input.recipient,
        subject: 'Invitación a Vestidos SaaS',
        text: `Te invitaron a ${input.empresaNombre} con el rol ${input.rol}. Abre este enlace para aceptar: ${input.url}`,
        html: `<p>Te invitaron a <strong>${empresa}</strong> con el rol <strong>${rol}</strong>.</p><p><a href="${url}">Aceptar invitación</a></p>`,
      });
    } catch {
      throw new MailDeliveryError();
    }
  }
}
