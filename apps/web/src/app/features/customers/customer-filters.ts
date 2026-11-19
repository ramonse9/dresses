import type { ParamMap } from '@angular/router';
import type { CustomerListFilters } from './customer.models';

export const DEFAULT_CUSTOMER_PAGE = 1;
export const DEFAULT_CUSTOMER_LIMIT = 20;
export const MAXIMUM_CUSTOMER_LIMIT = 100;
export const MAXIMUM_CUSTOMER_SEARCH_LENGTH = 254;

export function normalizeCustomerSearch(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, MAXIMUM_CUSTOMER_SEARCH_LENGTH);
}

export function customerFiltersFromParamMap(params: ParamMap): CustomerListFilters {
  const page = parsePositiveInteger(params.get('page'), DEFAULT_CUSTOMER_PAGE);
  const limit = parsePositiveInteger(
    params.get('limit'),
    DEFAULT_CUSTOMER_LIMIT,
    MAXIMUM_CUSTOMER_LIMIT,
  );
  const activeValue = params.get('activo');
  const q = normalizeCustomerSearch(params.get('q') ?? '');

  return {
    page,
    limit,
    ...(activeValue === 'true' || activeValue === 'false'
      ? { activo: activeValue === 'true' }
      : {}),
    ...(q ? { q } : {}),
  };
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
