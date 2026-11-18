import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import { getRefreshTokenTtlSeconds } from './auth.config.js';

export const AUTH_REFRESH_COOKIE_NAME = 'vestidos_refresh';
const authCookiePath = '/api/auth';
const refreshTokenPattern = /^[A-Za-z0-9_-]{43}$/;

@Injectable()
export class RefreshTokenCookieService {
  constructor(private readonly configService: ConfigService) {}

  read(request: Request): string {
    const cookieHeader = request.headers.cookie;

    if (!cookieHeader) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    const encodedToken = cookieHeader
      .split(';')
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith(`${AUTH_REFRESH_COOKIE_NAME}=`))
      ?.slice(AUTH_REFRESH_COOKIE_NAME.length + 1);

    if (!encodedToken) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    let refreshToken: string;

    try {
      refreshToken = decodeURIComponent(encodedToken);
    } catch {
      throw new UnauthorizedException('Refresh token inválido');
    }

    if (!refreshTokenPattern.test(refreshToken)) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    return refreshToken;
  }

  write(response: Response, refreshToken: string): void {
    response.cookie(
      AUTH_REFRESH_COOKIE_NAME,
      refreshToken,
      this.cookieOptions(),
    );
  }

  clear(response: Response): void {
    response.clearCookie(AUTH_REFRESH_COOKIE_NAME, this.baseCookieOptions());
  }

  private cookieOptions(): CookieOptions {
    return {
      ...this.baseCookieOptions(),
      maxAge: getRefreshTokenTtlSeconds(this.configService) * 1_000,
    };
  }

  private baseCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      path: authCookiePath,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
    };
  }
}
