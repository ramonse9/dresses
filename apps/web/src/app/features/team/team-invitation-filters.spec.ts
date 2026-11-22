import { convertToParamMap } from '@angular/router';
import {
  invitationFiltersFromParamMap,
  invitationFiltersToQueryParams,
  normalizeInvitationSearch,
} from './team-invitation-filters';

describe('team invitation filters', () => {
  it('parses pagination and supported filters', () => {
    expect(invitationFiltersFromParamMap(convertToParamMap({}))).toEqual({
      page: 1,
      limit: 20,
    });
    expect(
      invitationFiltersFromParamMap(
        convertToParamMap({
          page: '2',
          limit: '50',
          estado: 'PENDIENTE',
          rol: 'OWNER',
          q: '  PERSONA@EXAMPLE.TEST  ',
        }),
      ),
    ).toEqual({
      page: 2,
      limit: 50,
      estado: 'PENDIENTE',
      rol: 'OWNER',
      q: 'PERSONA@EXAMPLE.TEST',
    });
  });

  it('rejects unsupported values and limits search length', () => {
    expect(
      invitationFiltersFromParamMap(
        convertToParamMap({ page: '0', limit: '101', estado: 'BORRADOR', rol: 'ADMIN' }),
      ),
    ).toEqual({ page: 1, limit: 20 });
    expect(normalizeInvitationSearch(`  ${'a'.repeat(300)}  `)).toHaveLength(254);
  });

  it('serializes only supported filters', () => {
    expect(
      invitationFiltersToQueryParams({
        page: 3,
        limit: 10,
        estado: 'EXPIRADA',
        rol: 'EMPLOYEE',
        q: 'persona',
      }),
    ).toEqual({ page: 3, limit: 10, estado: 'EXPIRADA', rol: 'EMPLOYEE', q: 'persona' });
  });
});
