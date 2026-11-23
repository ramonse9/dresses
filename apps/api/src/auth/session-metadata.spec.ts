import type { Request } from 'express';
import { sessionMetadataFromRequest } from './session-metadata.js';

describe('sessionMetadataFromRequest', () => {
  it('keeps only request.ip and a bounded sanitized user agent', () => {
    const metadata = sessionMetadataFromRequest({
      ip: '203.0.113.10',
      headers: {
        'user-agent': ` Browser\u0000/${'x'.repeat(600)} `,
        authorization: 'Bearer never-store-this-token',
        cookie: 'vestidos_refresh=never-store-this-cookie',
        'x-forwarded-for': '198.51.100.20',
      },
    } as Pick<Request, 'ip' | 'headers'>);

    expect(metadata.ipAddress).toBe('203.0.113.10');
    expect(metadata.userAgent).toHaveLength(512);
    expect(metadata.userAgent).not.toContain('\u0000');
    expect(JSON.stringify(metadata)).not.toMatch(
      /never-store|authorization|cookie|x-forwarded-for|198\.51\.100\.20/i,
    );
  });

  it('accepts IPv6 and discards invalid addresses or empty agents', () => {
    expect(
      sessionMetadataFromRequest({
        ip: '::ffff:127.0.0.1',
        headers: {},
      } as Pick<Request, 'ip' | 'headers'>),
    ).toEqual({ ipAddress: '::ffff:127.0.0.1', userAgent: null });
    expect(
      sessionMetadataFromRequest({
        ip: 'untrusted-forwarded-value',
        headers: { 'user-agent': '   ' },
      } as Pick<Request, 'ip' | 'headers'>),
    ).toEqual({ ipAddress: null, userAgent: null });
  });
});
