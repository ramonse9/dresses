import { BadRequestException } from '@nestjs/common';
import { VestidoEstadoOperativo } from '../entities/vestido.tenant-entity.js';
import { parseListVestidosQuery } from './list-vestidos-query.dto.js';

describe('ListVestidos query validation', () => {
  it('uses the default pagination', () => {
    expect(parseListVestidosQuery({})).toEqual({ page: 1, limit: 20 });
  });

  it('parses every supported filter', () => {
    expect(
      parseListVestidosQuery({
        page: '2',
        limit: '50',
        sucursalId: 'A18C2A56-D33F-4D88-A8E7-42931121E295',
        activo: 'false',
        estadoOperativo: VestidoEstadoOperativo.MANTENIMIENTO,
        q: '  azul  ',
      }),
    ).toEqual({
      page: 2,
      limit: 50,
      sucursalId: 'a18c2a56-d33f-4d88-a8e7-42931121e295',
      activo: false,
      estadoOperativo: VestidoEstadoOperativo.MANTENIMIENTO,
      q: 'azul',
    });
  });

  it.each([
    { page: '0' },
    { page: '1.5' },
    { limit: '0' },
    { limit: '101' },
    { activo: 'yes' },
    { estadoOperativo: 'RENTADO' },
    { sucursalId: 'not-a-uuid' },
    { q: ' ' },
    { page: ['1', '2'] },
  ])('rejects invalid filters', (query) => {
    expect(() => parseListVestidosQuery(query)).toThrow(BadRequestException);
  });

  it.each([
    { empresaId: 'a18c2a56-d33f-4d88-a8e7-42931121e295' },
    { empresaSlug: 'atelier-norte' },
    { schemaName: 'tenant_untrusted' },
    { sort: 'nombre' },
  ])('rejects unknown filters and tenant selectors', (query) => {
    expect(() => parseListVestidosQuery(query)).toThrow(BadRequestException);
  });
});
