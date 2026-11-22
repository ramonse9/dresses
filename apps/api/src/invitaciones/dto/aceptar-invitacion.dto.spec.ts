import { BadRequestException } from '@nestjs/common';
import {
  parseAceptarInvitacionBody,
  parseVerificarInvitacionBody,
} from './aceptar-invitacion.dto.js';

const token = 'A'.repeat(43);

describe('public invitation DTOs', () => {
  it('accepts only an opaque token for verification', () => {
    expect(parseVerificarInvitacionBody({ token })).toEqual({ token });
    expect(() =>
      parseVerificarInvitacionBody({ token, empresaId: crypto.randomUUID() }),
    ).toThrow(BadRequestException);
    expect(() => parseVerificarInvitacionBody({ token: 'short' })).toThrow(
      BadRequestException,
    );
  });

  it('normalizes the optional name and preserves the password', () => {
    expect(
      parseAceptarInvitacionBody({
        token,
        nombre: '  Ana López  ',
        password: ' password with spaces ',
      }),
    ).toEqual({
      token,
      nombre: 'Ana López',
      password: ' password with spaces ',
    });
  });

  it.each([
    {},
    { token, password: 'short' },
    { token, password: 'secure-password', rol: 'OWNER' },
    { token, password: 'secure-password', empresaId: crypto.randomUUID() },
    { token, password: 'secure-password', schemaName: 'tenant_untrusted' },
    { token, password: 'secure-password', nombre: ' '.repeat(2) },
  ])('rejects an invalid acceptance payload %#', (body) => {
    expect(() => parseAceptarInvitacionBody(body)).toThrow(BadRequestException);
  });
});
