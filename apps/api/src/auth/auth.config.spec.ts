import { validateAuthEnvironment } from './auth.config.js';

describe('auth environment', () => {
  it('accepts a strong secret and short access token TTL', () => {
    const environment = {
      JWT_ACCESS_SECRET: 'a-secure-development-secret-with-32-bytes',
      JWT_ACCESS_TTL_SECONDS: '900',
      AUTH_REFRESH_TTL_SECONDS: '2592000',
    };

    expect(validateAuthEnvironment(environment)).toBe(environment);
  });

  it('rejects short secrets', () => {
    expect(() =>
      validateAuthEnvironment({
        JWT_ACCESS_SECRET: 'short',
        JWT_ACCESS_TTL_SECONDS: '900',
        AUTH_REFRESH_TTL_SECONDS: '2592000',
      }),
    ).toThrow('JWT_ACCESS_SECRET must contain at least 32 bytes');
  });

  it('rejects access tokens longer than one hour', () => {
    expect(() =>
      validateAuthEnvironment({
        JWT_ACCESS_SECRET: 'a-secure-development-secret-with-32-bytes',
        JWT_ACCESS_TTL_SECONDS: '7200',
        AUTH_REFRESH_TTL_SECONDS: '2592000',
      }),
    ).toThrow('JWT_ACCESS_TTL_SECONDS must be an integer between 60 and 3600');
  });

  it('rejects refresh sessions longer than 90 days', () => {
    expect(() =>
      validateAuthEnvironment({
        JWT_ACCESS_SECRET: 'a-secure-development-secret-with-32-bytes',
        JWT_ACCESS_TTL_SECONDS: '900',
        AUTH_REFRESH_TTL_SECONDS: String(91 * 24 * 3600),
      }),
    ).toThrow(
      'AUTH_REFRESH_TTL_SECONDS must be an integer between 3600 and 7776000',
    );
  });
});
