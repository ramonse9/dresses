import { BadRequestException } from '@nestjs/common';
import { EmpresaUsuarioRol } from '../../usuarios/entities/empresa-usuario.entity.js';
import { parseListMiembrosQuery } from './miembro.dto.js';

describe('parseListMiembrosQuery', () => {
  it('applies defaults and parses every supported filter', () => {
    expect(parseListMiembrosQuery({})).toEqual({ page: 1, limit: 20 });
    expect(
      parseListMiembrosQuery({
        page: '2',
        limit: '100',
        rol: EmpresaUsuarioRol.EMPLOYEE,
        activo: 'false',
        q: '  ana@example.com  ',
      }),
    ).toEqual({
      page: 2,
      limit: 100,
      rol: EmpresaUsuarioRol.EMPLOYEE,
      activo: false,
      q: 'ana@example.com',
    });
  });

  it.each([
    { limit: '101' },
    { page: '0' },
    { rol: 'ADMIN' },
    { activo: '1' },
    { q: '   ' },
    { empresaId: 'a18c2a56-d33f-4d88-a8e7-42931121e295' },
    { empresaSlug: 'atelier' },
    { schemaName: 'tenant_untrusted' },
    { usuarioId: 'a18c2a56-d33f-4d88-a8e7-42931121e295' },
  ])('rejects invalid or unknown filters: %o', (query) => {
    expect(() => parseListMiembrosQuery(query)).toThrow(BadRequestException);
  });
});
