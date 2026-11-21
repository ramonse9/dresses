import { Body, Controller, INestApplication, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ThrottlerModule, type ThrottlerOptions } from '@nestjs/throttler';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { configureTrustProxy } from '../src/config/trust-proxy.config.js';
import { AuthRateLimit } from '../src/security/auth-rate-limit/auth-rate-limit.decorator.js';
import {
  AUTH_RATE_LIMIT_POLICIES,
  getPolicyNames,
} from '../src/security/auth-rate-limit/auth-rate-limit.config.js';
import {
  AUTH_RATE_LIMIT_MESSAGE,
  AuthRateLimitGuard,
} from '../src/security/auth-rate-limit/auth-rate-limit.guard.js';

@Controller('_test/rate-limit')
class RateLimitProbeController {
  @Post('login')
  @AuthRateLimit(AUTH_RATE_LIMIT_POLICIES.LOGIN)
  login(@Body() body: unknown) {
    return { ok: true, receivedBody: body !== undefined };
  }

  @Post('invitation-verification')
  @AuthRateLimit(AUTH_RATE_LIMIT_POLICIES.INVITATION_VERIFICATION)
  invitationVerification() {
    return { ok: true };
  }

  @Post('refresh')
  refresh() {
    return { ok: true };
  }
}

describe('auth rate limiting (e2e)', () => {
  let app: INestApplication<App>;

  async function createApp(trustProxy = false): Promise<INestApplication<App>> {
    const options: ThrottlerOptions[] = getPolicyNames().map((name) => ({
      name,
      limit: name === AUTH_RATE_LIMIT_POLICIES.INVITATION_VERIFICATION ? 1 : 2,
      ttl: 120,
      blockDuration: 120,
      setHeaders: true,
    }));
    const moduleFixture = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(options)],
      controllers: [RateLimitProbeController],
      providers: [AuthRateLimitGuard],
    }).compile();
    const application = moduleFixture.createNestApplication<App>();
    application.setGlobalPrefix('api');
    configureTrustProxy(
      application,
      new ConfigService({ TRUST_PROXY: String(trustProxy) }),
    );
    await application.init();
    return application;
  }

  beforeEach(async () => {
    app = await createApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('allows requests within the limit and returns a generic 429 with Retry-After', async () => {
    const secretBody = {
      password: 'top-secret-password',
      token: 'top-secret-token',
      schemaName: 'tenant_should_not_appear',
    };

    await request(app.getHttpServer())
      .post('/api/_test/rate-limit/login')
      .set('Cookie', 'vestidos_refresh=top-secret-cookie')
      .send(secretBody)
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/_test/rate-limit/login')
      .send(secretBody)
      .expect(201);
    const response = await request(app.getHttpServer())
      .post('/api/_test/rate-limit/login')
      .send(secretBody)
      .expect(429);

    expect(response.headers['retry-after']).toMatch(/^\d+$/);
    expect(Number(response.headers['retry-after'])).toBeGreaterThanOrEqual(1);
    expect(response.body).toEqual({
      statusCode: 429,
      message: AUTH_RATE_LIMIT_MESSAGE,
    });
    expect(JSON.stringify(response.body)).not.toContain('top-secret');
    expect(JSON.stringify(response.body)).not.toContain('tenant_');
  });

  it('keeps policy windows independent and does not throttle refresh', async () => {
    await request(app.getHttpServer())
      .post('/api/_test/rate-limit/invitation-verification')
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/_test/rate-limit/invitation-verification')
      .expect(429);

    await request(app.getHttpServer())
      .post('/api/_test/rate-limit/login')
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/_test/rate-limit/login')
      .expect(201);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/_test/rate-limit/refresh')
        .expect(201);
    }
  });

  it('accepts login again after its window expires', async () => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/_test/rate-limit/login')
        .expect(201);
    }
    await request(app.getHttpServer())
      .post('/api/_test/rate-limit/login')
      .expect(429);

    await new Promise((resolve) => setTimeout(resolve, 160));

    await request(app.getHttpServer())
      .post('/api/_test/rate-limit/login')
      .expect(201);
  });

  it('ignores X-Forwarded-For when trust proxy is disabled', async () => {
    for (const forwardedIp of ['203.0.113.1', '203.0.113.2']) {
      await request(app.getHttpServer())
        .post('/api/_test/rate-limit/login')
        .set('X-Forwarded-For', forwardedIp)
        .expect(201);
    }

    await request(app.getHttpServer())
      .post('/api/_test/rate-limit/login')
      .set('X-Forwarded-For', '203.0.113.3')
      .expect(429);
  });

  it('uses forwarded client IPs only when trust proxy is explicitly enabled', async () => {
    await app.close();
    app = await createApp(true);

    for (const forwardedIp of ['203.0.113.1', '203.0.113.2', '203.0.113.3']) {
      await request(app.getHttpServer())
        .post('/api/_test/rate-limit/login')
        .set('X-Forwarded-For', forwardedIp)
        .expect(201);
    }
  });
});
