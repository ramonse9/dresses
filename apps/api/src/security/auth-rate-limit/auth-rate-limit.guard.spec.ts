import type { Request } from 'express';
import {
  AUTH_RATE_LIMIT_MESSAGE,
  getAuthRateLimitTracker,
} from './auth-rate-limit.guard.js';

describe('AuthRateLimitGuard', () => {
  it('uses only request.ip as the tracker', () => {
    const request = {
      ip: '203.0.113.10',
      body: {
        password: 'never-store-this-password',
        token: 'never-store-this-token',
        schemaName: 'tenant_untrusted',
      },
      headers: {
        authorization: 'Bearer never-store-this-token',
        cookie: 'vestidos_refresh=never-store-this-cookie',
        'x-forwarded-for': '198.51.100.20',
      },
    } as unknown as Request;

    const tracker = getAuthRateLimitTracker(request);

    expect(tracker).toBe('203.0.113.10');
    expect(tracker).not.toContain('password');
    expect(tracker).not.toContain('token');
    expect(tracker).not.toContain('cookie');
    expect(tracker).not.toContain('tenant');
    expect(tracker).not.toContain('198.51.100.20');
  });

  it('falls back to a non-secret constant when the adapter has no IP', () => {
    expect(getAuthRateLimitTracker({ ip: undefined })).toBe('unknown');
  });

  it('uses a generic public error message', () => {
    expect(AUTH_RATE_LIMIT_MESSAGE).toBe(
      'Demasiadas solicitudes. Intenta nuevamente más tarde.',
    );
  });
});
