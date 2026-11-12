import { BadRequestException } from '@nestjs/common';
import { parseSelectEmpresaBody } from './select-empresa.dto.js';

describe('parseSelectEmpresaBody', () => {
  const empresaId = 'a18c2a56-d33f-4d88-a8e7-42931121e295';

  it('accepts only empresaId', () => {
    expect(parseSelectEmpresaBody({ empresaId })).toEqual({ empresaId });
  });

  it.each([
    null,
    {},
    { empresaId: 'not-a-uuid' },
    { empresaId, schemaName: 'tenant_untrusted' },
    { empresaId, usuarioId: 'another-user' },
  ])('rejects invalid or additional fields', (body) => {
    expect(() => parseSelectEmpresaBody(body)).toThrow(BadRequestException);
  });
});
