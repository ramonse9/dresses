import { convertToParamMap } from '@angular/router';
import {
  dressFiltersFromParamMap,
  dressFiltersToQueryParams,
  normalizeDressSearch,
} from './dress-filters';

describe('dress filters', () => {
  const branchId = '11111111-1111-4111-8111-111111111111';

  it('uses API pagination defaults', () => {
    expect(dressFiltersFromParamMap(convertToParamMap({}))).toEqual({ page: 1, limit: 20 });
  });

  it('parses all supported query parameters', () => {
    expect(
      dressFiltersFromParamMap(
        convertToParamMap({
          page: '2',
          limit: '50',
          sucursalId: branchId.toUpperCase(),
          activo: 'false',
          estadoOperativo: 'MANTENIMIENTO',
          q: '  Gala   Roja  ',
        }),
      ),
    ).toEqual({
      page: 2,
      limit: 50,
      sucursalId: branchId,
      activo: false,
      estadoOperativo: 'MANTENIMIENTO',
      q: 'Gala Roja',
    });
  });

  it('drops invalid filters and bounds search text', () => {
    expect(
      dressFiltersFromParamMap(
        convertToParamMap({
          page: '0',
          limit: '101',
          sucursalId: 'unsafe',
          activo: 'yes',
          estadoOperativo: 'RENTADO',
          q: `  ${'x'.repeat(200)}  `,
        }),
      ),
    ).toEqual({ page: 1, limit: 20, q: 'x'.repeat(160) });
  });

  it('serializes only supported filters', () => {
    expect(
      dressFiltersToQueryParams({
        page: 3,
        limit: 20,
        sucursalId: branchId,
        activo: true,
        estadoOperativo: 'DISPONIBLE',
        q: 'Gala',
      }),
    ).toEqual({
      page: 3,
      limit: 20,
      sucursalId: branchId,
      activo: 'true',
      estadoOperativo: 'DISPONIBLE',
      q: 'Gala',
    });
    expect(normalizeDressSearch('  Gala   Roja  ')).toBe('Gala Roja');
  });
});
