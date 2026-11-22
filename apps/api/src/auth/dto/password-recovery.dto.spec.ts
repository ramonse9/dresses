import {
  PASSWORD_RESET_INVALID_MESSAGE,
  parseRequestPasswordRecoveryBody,
  parseResetPasswordBody,
} from './password-recovery.dto.js';

describe('password recovery DTOs', () => {
  it('normalizes a strict recovery email', () => {
    expect(
      parseRequestPasswordRecoveryBody({
        email: '  PERSON@Example.COM  ',
      }),
    ).toEqual({ email: 'person@example.com' });
  });

  it('parses an opaque token and password without transforming secrets', () => {
    const token = 'A'.repeat(43);
    expect(
      parseResetPasswordBody({ token, password: 'new-secure-password' }),
    ).toEqual({ token, password: 'new-secure-password' });
  });

  it.each([
    { email: 'person@example.com', empresaId: 'untrusted' },
    { email: 'person@example.com', rol: 'OWNER' },
    { email: 'person@example.com', schemaName: 'tenant_untrusted' },
    { token: 'A'.repeat(43), password: 'new-password', estado: 'USADO' },
  ])('rejects unknown or controlled fields: %o', (body) => {
    expect(() =>
      'token' in body
        ? parseResetPasswordBody(body)
        : parseRequestPasswordRecoveryBody(body),
    ).toThrow('Campo no permitido');
  });

  it('uses a generic error for malformed tokens and validates passwords', () => {
    expect(() =>
      parseResetPasswordBody({ token: 'short', password: 'new-password' }),
    ).toThrow(PASSWORD_RESET_INVALID_MESSAGE);
    expect(() =>
      parseResetPasswordBody({ token: 'A'.repeat(43), password: 'short' }),
    ).toThrow('password debe tener entre 8 y 1024 caracteres');
  });
});
