import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { getAllowedCorsOrigins } from '../config/cors.config.js';

@Injectable()
export class AuthOriginGuard implements CanActivate {
  private readonly allowedOrigins: ReadonlySet<string>;

  constructor(configService: ConfigService) {
    this.allowedOrigins = new Set(getAllowedCorsOrigins(configService));
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const origin = request.headers.origin;

    if (origin === undefined) {
      return true;
    }

    if (typeof origin !== 'string' || !this.allowedOrigins.has(origin)) {
      throw new ForbiddenException('Origin no permitido');
    }

    return true;
  }
}
