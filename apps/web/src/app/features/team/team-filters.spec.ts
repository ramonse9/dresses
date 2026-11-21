import { convertToParamMap } from '@angular/router';
import {
  normalizeTeamSearch,
  teamFiltersFromParamMap,
  teamFiltersToQueryParams,
} from './team-filters';

describe('team filters', () => {
  it('uses pagination defaults and parses supported filters', () => {
    expect(teamFiltersFromParamMap(convertToParamMap({}))).toEqual({ page: 1, limit: 20 });
    expect(
      teamFiltersFromParamMap(
        convertToParamMap({
          page: '2',
          limit: '50',
          rol: 'EMPLOYEE',
          activo: 'false',
          q: '  Ana   López  ',
        }),
      ),
    ).toEqual({ page: 2, limit: 50, rol: 'EMPLOYEE', activo: false, q: 'Ana López' });
  });

  it('rejects invalid URL values and bounds searches', () => {
    expect(
      teamFiltersFromParamMap(
        convertToParamMap({ page: '0', limit: '101', rol: 'ADMIN', activo: 'yes' }),
      ),
    ).toEqual({ page: 1, limit: 20 });
    expect(normalizeTeamSearch(`  Ana   ${'x'.repeat(300)}  `)).toHaveLength(254);
  });

  it('serializes only supported filters', () => {
    expect(
      teamFiltersToQueryParams({
        page: 3,
        limit: 50,
        rol: 'OWNER',
        activo: true,
        q: 'Ana',
      }),
    ).toEqual({ page: 3, limit: 50, rol: 'OWNER', activo: 'true', q: 'Ana' });
  });
});
