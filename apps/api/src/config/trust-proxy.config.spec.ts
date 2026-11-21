import { ConfigService } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';
import {
  configureTrustProxy,
  isTrustProxyEnabled,
  validateTrustProxyEnvironment,
} from './trust-proxy.config.js';

describe('trust proxy configuration', () => {
  it('does not trust proxy headers by default', () => {
    expect(isTrustProxyEnabled(new ConfigService())).toBe(false);
    expect(
      isTrustProxyEnabled(new ConfigService({ TRUST_PROXY: 'false' })),
    ).toBe(false);
  });

  it('enables trust proxy only through an explicit true value', () => {
    expect(
      isTrustProxyEnabled(new ConfigService({ TRUST_PROXY: 'true' })),
    ).toBe(true);
  });

  it('rejects ambiguous or unsafe values', () => {
    for (const value of ['1', 'yes', '*', 'loopback', 'TRUE']) {
      expect(() =>
        validateTrustProxyEnvironment({ TRUST_PROXY: value }),
      ).toThrow('TRUST_PROXY must be true or false');
    }
  });

  it('configures the underlying Express application', () => {
    const set = vi.fn();
    const app = {
      getHttpAdapter: () => ({ getInstance: () => ({ set }) }),
    } as unknown as INestApplication;

    configureTrustProxy(app, new ConfigService({ TRUST_PROXY: 'true' }));

    expect(set).toHaveBeenCalledWith('trust proxy', true);
  });
});
