import {
  AUTH_RATE_LIMIT_POLICIES,
  createAuthRateLimitOptions,
  getPolicyNames,
  validateAuthRateLimitEnvironment,
} from './auth-rate-limit.config.js';

describe('auth rate limit configuration', () => {
  it('defines independent conservative defaults for every public auth flow', () => {
    expect(createAuthRateLimitOptions(() => undefined)).toEqual([
      {
        name: AUTH_RATE_LIMIT_POLICIES.LOGIN,
        limit: 5,
        ttl: 60_000,
        blockDuration: 60_000,
        setHeaders: true,
      },
      {
        name: AUTH_RATE_LIMIT_POLICIES.INVITATION_VERIFICATION,
        limit: 20,
        ttl: 60_000,
        blockDuration: 60_000,
        setHeaders: true,
      },
      {
        name: AUTH_RATE_LIMIT_POLICIES.INVITATION_ACCEPTANCE,
        limit: 5,
        ttl: 300_000,
        blockDuration: 300_000,
        setHeaders: true,
      },
      {
        name: AUTH_RATE_LIMIT_POLICIES.PASSWORD_RECOVERY_REQUEST,
        limit: 3,
        ttl: 900_000,
        blockDuration: 900_000,
        setHeaders: true,
      },
      {
        name: AUTH_RATE_LIMIT_POLICIES.PASSWORD_RESET,
        limit: 5,
        ttl: 900_000,
        blockDuration: 900_000,
        setHeaders: true,
      },
    ]);
  });

  it('reads each policy from its own environment variables', () => {
    const environment: Record<string, string> = {
      AUTH_RATE_LIMIT_LOGIN_LIMIT: '7',
      AUTH_RATE_LIMIT_LOGIN_WINDOW_SECONDS: '11',
      AUTH_RATE_LIMIT_INVITATION_VERIFICATION_LIMIT: '13',
      AUTH_RATE_LIMIT_INVITATION_VERIFICATION_WINDOW_SECONDS: '17',
      AUTH_RATE_LIMIT_INVITATION_ACCEPTANCE_LIMIT: '19',
      AUTH_RATE_LIMIT_INVITATION_ACCEPTANCE_WINDOW_SECONDS: '23',
      AUTH_RATE_LIMIT_RECOVERY_REQUEST_LIMIT: '29',
      AUTH_RATE_LIMIT_RECOVERY_REQUEST_WINDOW_SECONDS: '31',
      AUTH_RATE_LIMIT_PASSWORD_RESET_LIMIT: '37',
      AUTH_RATE_LIMIT_PASSWORD_RESET_WINDOW_SECONDS: '41',
    };

    const options = createAuthRateLimitOptions((key) => environment[key]);

    expect(options).toMatchObject([
      { name: 'login', limit: 7, ttl: 11_000 },
      { name: 'invitation-verification', limit: 13, ttl: 17_000 },
      { name: 'invitation-acceptance', limit: 19, ttl: 23_000 },
      { name: 'password-recovery-request', limit: 29, ttl: 31_000 },
      { name: 'password-reset', limit: 37, ttl: 41_000 },
    ]);
  });

  it('rejects invalid limits and windows without reflecting their values', () => {
    for (const value of ['0', '-1', '1.5', '86401', 'secret-value']) {
      expect(() =>
        validateAuthRateLimitEnvironment({
          AUTH_RATE_LIMIT_LOGIN_LIMIT: value,
        }),
      ).toThrow('AUTH_RATE_LIMIT_LOGIN_LIMIT');

      try {
        validateAuthRateLimitEnvironment({
          AUTH_RATE_LIMIT_LOGIN_LIMIT: value,
        });
      } catch (error) {
        expect(String(error)).not.toContain(value);
      }
    }
  });

  it('exposes five unique reusable policy names', () => {
    const names = getPolicyNames();

    expect(names).toHaveLength(5);
    expect(new Set(names).size).toBe(names.length);
  });
});
