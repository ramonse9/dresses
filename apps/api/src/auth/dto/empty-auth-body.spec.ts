import { BadRequestException } from '@nestjs/common';
import { assertEmptyAuthBody } from './empty-auth-body.js';

describe('assertEmptyAuthBody', () => {
  it.each([undefined, null, {}])('accepts an empty body', (body) => {
    expect(() => assertEmptyAuthBody(body)).not.toThrow();
  });

  it.each([
    { refreshToken: 'client-controlled' },
    { schemaName: 'public' },
    [],
    'refresh-token',
  ])('rejects body fields and non-object values', (body) => {
    expect(() => assertEmptyAuthBody(body)).toThrow(BadRequestException);
  });
});
