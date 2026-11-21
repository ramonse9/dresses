import {
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import type { Request, Response } from 'express';

export const AUTH_RATE_LIMIT_MESSAGE =
  'Demasiadas solicitudes. Intenta nuevamente más tarde.';

export function getAuthRateLimitTracker(request: Pick<Request, 'ip'>): string {
  return request.ip ?? 'unknown';
}

@Injectable()
export class AuthRateLimitGuard extends ThrottlerGuard {
  protected override getTracker(request: Request): Promise<string> {
    return Promise.resolve(getAuthRateLimitTracker(request));
  }

  protected override throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    const response = context.switchToHttp().getResponse<Response>();
    response.setHeader('Retry-After', Math.max(1, detail.timeToBlockExpire));

    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: AUTH_RATE_LIMIT_MESSAGE,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
