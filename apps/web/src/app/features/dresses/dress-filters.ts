import type { ParamMap } from '@angular/router';
import {
  DRESS_OPERATIONAL_STATES,
  type DressListFilters,
  type DressOperationalState,
} from './dress.models';

export const DEFAULT_DRESS_PAGE = 1;
export const DEFAULT_DRESS_LIMIT = 20;
export const MAXIMUM_DRESS_LIMIT = 100;
export const MAXIMUM_DRESS_SEARCH_LENGTH = 160;

const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeDressSearch(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, MAXIMUM_DRESS_SEARCH_LENGTH);
}

export function dressFiltersFromParamMap(params: ParamMap): DressListFilters {
  const page = parsePositiveInteger(params.get('page'), DEFAULT_DRESS_PAGE);
  const limit = parsePositiveInteger(params.get('limit'), DEFAULT_DRESS_LIMIT, MAXIMUM_DRESS_LIMIT);
  const sucursalValue = params.get('sucursalId');
  const activeValue = params.get('activo');
  const operationalValue = params.get('estadoOperativo');
  const q = normalizeDressSearch(params.get('q') ?? '');

  return {
    page,
    limit,
    ...(sucursalValue && uuidV4Pattern.test(sucursalValue)
      ? { sucursalId: sucursalValue.toLowerCase() }
      : {}),
    ...(activeValue === 'true' || activeValue === 'false'
      ? { activo: activeValue === 'true' }
      : {}),
    ...(isOperationalState(operationalValue) ? { estadoOperativo: operationalValue } : {}),
    ...(q ? { q } : {}),
  };
}

export function dressFiltersToQueryParams(
  filters: DressListFilters,
): Record<string, string | number> {
  return {
    page: filters.page,
    limit: filters.limit,
    ...(filters.sucursalId ? { sucursalId: filters.sucursalId } : {}),
    ...(filters.activo === undefined ? {} : { activo: String(filters.activo) }),
    ...(filters.estadoOperativo ? { estadoOperativo: filters.estadoOperativo } : {}),
    ...(filters.q ? { q: filters.q } : {}),
  };
}

function isOperationalState(value: string | null): value is DressOperationalState {
  return DRESS_OPERATIONAL_STATES.some((state) => state === value);
}

function parsePositiveInteger(value: string | null, fallback: number, maximum?: number): number {
  if (!value || !/^[1-9]\d*$/.test(value)) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || (maximum !== undefined && parsed > maximum)) {
    return fallback;
  }
  return parsed;
}
