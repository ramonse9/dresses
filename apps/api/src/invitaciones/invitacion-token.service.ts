import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { TransactionalMailService } from '../mail/transactional-mail.service.js';

export type GeneratedInvitationToken = Readonly<{
  token: string;
  hash: string;
}>;

@Injectable()
export class InvitacionTokenService {
  constructor(private readonly mailService: TransactionalMailService) {}

  generate(): GeneratedInvitationToken {
    const token = randomBytes(32).toString('base64url');
    return { token, hash: this.hash(token) };
  }

  hash(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  buildAcceptanceUrl(token: string): string {
    const origin = this.mailService.getWebAppOrigin();
    return `${origin}/aceptar-invitacion#token=${encodeURIComponent(token)}`;
  }
}
