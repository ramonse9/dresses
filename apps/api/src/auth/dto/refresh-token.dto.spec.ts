import { BadRequestException } from '@nestjs/common';
import { parseRefreshTokenBody } from './refresh-token.dto.js';

describe('parseRefreshTokenBody', () => {
  const token = 'A'.repeat(43);

  it('accepts a single opaque refresh token', () => {
    expect(parseRefreshTokenBody({ refreshToken: token })).toEqual({
      refreshToken: token,
    });
  });

  it.each([
    null,
    {},
    { refreshToken: 'short' },
    { refreshToken: token, schemaName: 'public' },
  ])('rejects malformed bodies', (body) => {
    expect(() => parseRefreshTokenBody(body)).toThrow(BadRequestException);
  });
});
