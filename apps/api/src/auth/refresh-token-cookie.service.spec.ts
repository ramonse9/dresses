import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import {
  AUTH_REFRESH_COOKIE_NAME,
  RefreshTokenCookieService,
} from './refresh-token-cookie.service.js';

describe('RefreshTokenCookieService', () => {
  const refreshToken = 'A'.repeat(43);

  function createService(nodeEnvironment = 'development') {
    return new RefreshTokenCookieService(
      new ConfigService({
        AUTH_REFRESH_TTL_SECONDS: '2592000',
        NODE_ENV: nodeEnvironment,
      }),
    );
  }

  it('writes an HttpOnly development cookie with the session TTL', () => {
    const cookie = vi.fn();
    const service = createService();

    service.write({ cookie } as unknown as Response, refreshToken);

    expect(cookie).toHaveBeenCalledWith(
      AUTH_REFRESH_COOKIE_NAME,
      refreshToken,
      {
        httpOnly: true,
        sameSite: 'lax',
        path: '/api/auth',
        secure: false,
        maxAge: 2_592_000_000,
      },
    );
  });

  it('sets Secure in production and preserves the flags when clearing', () => {
    const cookie = vi.fn();
    const clearCookie = vi.fn();
    const service = createService('production');
    const response = { cookie, clearCookie } as unknown as Response;

    service.write(response, refreshToken);
    service.clear(response);

    expect(cookie.mock.calls[0]?.[2]).toMatchObject({ secure: true });
    expect(clearCookie).toHaveBeenCalledWith(AUTH_REFRESH_COOKIE_NAME, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/api/auth',
      secure: true,
    });
  });

  it('reads only the named cookie and rejects missing or malformed tokens', () => {
    const service = createService();
    const request = {
      headers: {
        cookie: `unrelated=value; ${AUTH_REFRESH_COOKIE_NAME}=${refreshToken}`,
      },
    } as Request;

    expect(service.read(request)).toBe(refreshToken);
    expect(() => service.read({ headers: {} } as Request)).toThrow(
      UnauthorizedException,
    );
    expect(() =>
      service.read({
        headers: { cookie: `${AUTH_REFRESH_COOKIE_NAME}=short` },
      } as Request),
    ).toThrow(UnauthorizedException);
  });
});
