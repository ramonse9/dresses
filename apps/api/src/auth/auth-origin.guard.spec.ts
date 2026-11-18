import { ConfigService } from '@nestjs/config';
import type { ExecutionContext } from '@nestjs/common';
import { AuthOriginGuard } from './auth-origin.guard.js';

describe('AuthOriginGuard', () => {
  const guard = new AuthOriginGuard(
    new ConfigService({
      CORS_ALLOWED_ORIGINS: 'http://localhost:4200',
    }),
  );

  function context(origin?: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { origin } }),
      }),
    } as unknown as ExecutionContext;
  }

  it('allows configured origins and requests without Origin', () => {
    expect(guard.canActivate(context('http://localhost:4200'))).toBe(true);
    expect(guard.canActivate(context())).toBe(true);
  });

  it('rejects an untrusted Origin', () => {
    expect(() => guard.canActivate(context('https://evil.example'))).toThrow(
      'Origin no permitido',
    );
  });
});
