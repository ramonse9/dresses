import {
  assertEmptyAuthSessionsQuery,
  parseListAuthSessionsQuery,
} from './auth-session.dto.js';

describe('auth session DTOs', () => {
  it('uses safe defaults and parses the allowed filters', () => {
    expect(parseListAuthSessionsQuery({})).toEqual({
      revoked: false,
      limit: 50,
    });
    expect(
      parseListAuthSessionsQuery({ revoked: 'true', limit: '100' }),
    ).toEqual({ revoked: true, limit: 100 });
  });

  it.each([
    [{ empresaId: 'untrusted' }, 'Filtro no permitido: empresaId'],
    [{ schemaName: 'tenant_untrusted' }, 'Filtro no permitido: schemaName'],
    [{ revoked: 'all' }, 'revoked debe ser true o false'],
    [{ limit: '0' }, 'limit debe ser un entero positivo'],
    [{ limit: '101' }, 'limit no puede ser mayor que 100'],
  ])('rejects invalid or unknown filters', (query, message) => {
    expect(() => parseListAuthSessionsQuery(query)).toThrow(message);
  });

  it('requires empty query parameters for mutations', () => {
    expect(() => assertEmptyAuthSessionsQuery({})).not.toThrow();
    expect(() =>
      assertEmptyAuthSessionsQuery({ empresaSlug: 'untrusted' }),
    ).toThrow('Filtro no permitido: empresaSlug');
  });
});
