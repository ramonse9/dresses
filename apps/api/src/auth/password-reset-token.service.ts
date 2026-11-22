import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { TransactionalMailService } from '../mail/transactional-mail.service.js';

export type GeneratedPasswordResetToken = Readonly<{
  token: string;
  hash: string;
}>;

@Injectable()
export class PasswordResetTokenService {
  constructor(private readonly mailService: TransactionalMailService) {}

  generate(): GeneratedPasswordResetToken {
    const token = randomBytes(32).toString('base64url');
    return { token, hash: this.hash(token) };
  }

  hash(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  buildResetUrl(token: string): string {
    return `${this.mailService.getWebAppOrigin()}/restablecer-password#token=${encodeURIComponent(token)}`;
  }
}
