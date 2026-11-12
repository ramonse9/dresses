import { BadRequestException } from '@nestjs/common';
import { parseLoginBody } from './login.dto.js';

describe('parseLoginBody', () => {
  it('normalizes email without changing the password', () => {
    expect(
      parseLoginBody({
        email: ' Owner@Example.COM ',
        password: ' secret value ',
      }),
    ).toEqual({
      email: 'owner@example.com',
      password: ' secret value ',
    });
  });

  it.each([
    null,
    {},
    { email: 'invalid', password: 'valid-password' },
    { email: 'owner@example.com', password: 'short' },
    {
      email: 'owner@example.com',
      password: 'valid-password',
      schemaName: 'public',
    },
  ])('rejects invalid login bodies', (body) => {
    expect(() => parseLoginBody(body)).toThrow(BadRequestException);
  });
});
