import type { INestApplication } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

export function isTrustProxyEnabled(configService: ConfigService): boolean {
  return parseTrustProxy(configService.get<string>('TRUST_PROXY'));
}

export function configureTrustProxy(
  app: INestApplication,
  configService: ConfigService,
): void {
  const expressApplication = app.getHttpAdapter().getInstance() as {
    set(name: string, value: boolean): void;
  };
  expressApplication.set('trust proxy', isTrustProxyEnabled(configService));
}

export function validateTrustProxyEnvironment(
  environment: Record<string, unknown>,
): Record<string, unknown> {
  const value = environment.TRUST_PROXY;
  parseTrustProxy(typeof value === 'string' ? value : undefined);
  return environment;
}

function parseTrustProxy(value: string | undefined): boolean {
  if (value === undefined || value === 'false') {
    return false;
  }
  if (value === 'true') {
    return true;
  }
  throw new Error('TRUST_PROXY must be true or false');
}
