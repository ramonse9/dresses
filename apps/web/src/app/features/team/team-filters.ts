import type { ParamMap } from '@angular/router';
import type { EmpresaRole } from '../../core/tenant/tenant.models';
import type { TeamListFilters } from './team.models';

export const DEFAULT_TEAM_PAGE = 1;
export const DEFAULT_TEAM_LIMIT = 20;
export const MAXIMUM_TEAM_LIMIT = 100;
export const MAXIMUM_TEAM_SEARCH_LENGTH = 254;

export function normalizeTeamSearch(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, MAXIMUM_TEAM_SEARCH_LENGTH);
}

export function teamFiltersFromParamMap(params: ParamMap): TeamListFilters {
  const page = parsePositiveInteger(params.get('page'), DEFAULT_TEAM_PAGE);
  const limit = parsePositiveInteger(params.get('limit'), DEFAULT_TEAM_LIMIT, MAXIMUM_TEAM_LIMIT);
  const roleValue = params.get('rol');
  const activeValue = params.get('activo');
  const q = normalizeTeamSearch(params.get('q') ?? '');

  return {
    page,
    limit,
    ...(isTeamRole(roleValue) ? { rol: roleValue } : {}),
    ...(activeValue === 'true' || activeValue === 'false'
      ? { activo: activeValue === 'true' }
      : {}),
    ...(q ? { q } : {}),
  };
}

export function teamFiltersToQueryParams(
  filters: TeamListFilters,
): Record<string, string | number> {
  return {
    page: filters.page,
    limit: filters.limit,
    ...(filters.rol ? { rol: filters.rol } : {}),
    ...(filters.activo === undefined ? {} : { activo: String(filters.activo) }),
    ...(filters.q ? { q: filters.q } : {}),
  };
}

function isTeamRole(value: string | null): value is EmpresaRole {
  return value === 'OWNER' || value === 'EMPLOYEE';
}

function parsePositiveInteger(value: string | null, fallback: number, maximum?: number): number {
  if (!value || !/^[1-9]\d*$/.test(value)) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && (maximum === undefined || parsed <= maximum)
    ? parsed
    : fallback;
}
