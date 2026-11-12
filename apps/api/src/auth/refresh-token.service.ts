import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';

export interface RefreshTokenPair {
  token: string;
  hash: string;
}

@Injectable()
export class RefreshTokenService {
  issue(): RefreshTokenPair {
    const token = randomBytes(32).toString('base64url');
    return { token, hash: this.hash(token) };
  }

  hash(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }
}
