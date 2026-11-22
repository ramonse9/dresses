import { BadRequestException } from '@nestjs/common';
import { EmpresaUsuarioRol } from '../../usuarios/entities/empresa-usuario.entity.js';
import { EmpresaInvitacionEstado } from '../entities/empresa-invitacion.entity.js';
import {
  assertEmptyInvitacionBody,
  parseCreateInvitacionBody,
  parseListInvitacionesQuery,
} from './invitacion.dto.js';

describe('invitacion DTOs', () => {
  it('normalizes a strict creation body', () => {
    expect(
      parseCreateInvitacionBody({
        email: '  PERSONA@EXAMPLE.COM  ',
        rol: 'EMPLOYEE',
      }),
    ).toEqual({
      email: 'persona@example.com',
      rol: EmpresaUsuarioRol.EMPLOYEE,
    });
  });

  it.each([
    {},
    { email: 'invalid', rol: 'EMPLOYEE' },
    { email: 'persona@example.com', rol: 'ADMIN' },
    { email: 'persona@example.com', rol: 'EMPLOYEE', empresaId: 'untrusted' },
    {
      email: 'persona@example.com',
      rol: 'EMPLOYEE',
      schemaName: 'tenant_untrusted',
    },
    { email: 'persona@example.com', rol: 'EMPLOYEE', token: 'untrusted' },
  ])('rejects invalid, protected or unknown creation fields: %o', (body) => {
    expect(() => parseCreateInvitacionBody(body)).toThrow(BadRequestException);
  });

  it('parses pagination and every supported list filter', () => {
    expect(
      parseListInvitacionesQuery({
        page: '2',
        limit: '100',
        estado: 'EXPIRADA',
        rol: 'OWNER',
        q: '  PERSONA@EXAMPLE.COM ',
      }),
    ).toEqual({
      page: 2,
      limit: 100,
      estado: EmpresaInvitacionEstado.EXPIRADA,
      rol: EmpresaUsuarioRol.OWNER,
      q: 'persona@example.com',
    });
  });

  it.each([
    { page: '0' },
    { limit: '101' },
    { estado: 'INVALIDA' },
    { rol: 'ADMIN' },
    { q: ' ' },
    { empresaId: 'untrusted' },
    { empresaSlug: 'untrusted' },
    { schemaName: 'tenant_untrusted' },
  ])('rejects unknown or invalid filters: %o', (query) => {
    expect(() => parseListInvitacionesQuery(query)).toThrow(
      BadRequestException,
    );
  });

  it('accepts only empty resend and revoke bodies', () => {
    expect(() => assertEmptyInvitacionBody(undefined)).not.toThrow();
    expect(() => assertEmptyInvitacionBody({})).not.toThrow();
    expect(() => assertEmptyInvitacionBody({ empresaId: 'untrusted' })).toThrow(
      BadRequestException,
    );
  });
});
