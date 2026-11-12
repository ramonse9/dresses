import { validateAuthEnvironment } from './auth.config.js';

describe('auth environment', () => {
  it('accepts a strong secret and short access token TTL', () => {
    const environment = {
      JWT_ACCESS_SECRET: 'a-secure-development-secret-with-32-bytes',
      JWT_ACCESS_TTL_SECONDS: '900',
    };

    expect(validateAuthEnvironment(environment)).toBe(environment);
  });

  it('rejects short secrets', () => {
    expect(() =>
      validateAuthEnvironment({
        JWT_ACCESS_SECRET: 'short',
        JWT_ACCESS_TTL_SECONDS: '900',
      }),
    ).toThrow('JWT_ACCESS_SECRET must contain at least 32 bytes');
  });

  it('rejects access tokens longer than one hour', () => {
    expect(() =>
      validateAuthEnvironment({
        JWT_ACCESS_SECRET: 'a-secure-development-secret-with-32-bytes',
        JWT_ACCESS_TTL_SECONDS: '7200',
      }),
    ).toThrow('JWT_ACCESS_TTL_SECONDS must be an integer between 60 and 3600');
  });
});
