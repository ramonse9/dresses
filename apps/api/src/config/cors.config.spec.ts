import { ConfigService } from '@nestjs/config';
import {
  createCorsOptions,
  getAllowedCorsOrigins,
  validateCorsEnvironment,
} from './cors.config.js';

describe('CORS configuration', () => {
  it('enables credentials for explicit configured origins', () => {
    const config = new ConfigService({
      CORS_ALLOWED_ORIGINS: 'http://localhost:4200,http://127.0.0.1:4200',
    });

    expect(createCorsOptions(config)).toEqual({
      origin: ['http://localhost:4200', 'http://127.0.0.1:4200'],
      credentials: true,
    });
  });

  it('uses only the authorized local origins by default in development', () => {
    expect(getAllowedCorsOrigins(new ConfigService())).toEqual([
      'http://localhost:4200',
      'http://127.0.0.1:4200',
    ]);
  });

  it('rejects wildcard, malformed and path-based origins', () => {
    for (const origins of ['*', 'not-a-url', 'http://localhost:4200/path']) {
      expect(() =>
        validateCorsEnvironment({ CORS_ALLOWED_ORIGINS: origins }),
      ).toThrow();
    }
  });

  it('requires explicit origins in production', () => {
    expect(() => validateCorsEnvironment({ NODE_ENV: 'production' })).toThrow(
      'CORS_ALLOWED_ORIGINS is required in production',
    );
  });
});
