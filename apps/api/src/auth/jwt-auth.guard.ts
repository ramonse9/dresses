import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { normalizeEmail } from '../usuarios/email.js';
import { AuthSessionsService } from './auth-sessions.service.js';
import type { AccessTokenPayload } from './types/access-token-payload.js';

export interface AuthenticatedRequest extends Request {
  user: AccessTokenPayload;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parsePayload(payload: unknown): AccessTokenPayload {
  if (typeof payload !== 'object' || payload === null) {
    throw new UnauthorizedException('Token inválido');
  }

  const claims = payload as Record<string, unknown>;
  const { sub, email, sessionId } = claims;

  if (
    typeof sub !== 'string' ||
    !uuidPattern.test(sub) ||
    typeof email !== 'string' ||
    normalizeEmail(email) !== email ||
    typeof sessionId !== 'string' ||
    !uuidPattern.test(sessionId)
  ) {
    throw new UnauthorizedException('Token inválido');
  }

  return { sub, email, sessionId };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authSessionsService: AuthSessionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const match = authorization?.match(/^Bearer ([^\s]+)$/i);

    if (!match) {
      throw new UnauthorizedException('Token inválido');
    }

    try {
      const payload = parsePayload(await this.jwtService.verifyAsync(match[1]));
      await this.authSessionsService.assertActive(
        payload.sessionId,
        payload.sub,
      );
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido');
    }
  }
}
