import { convertToParamMap } from '@angular/router';
import { customerFiltersFromParamMap, normalizeCustomerSearch } from './customer-filters';

describe('customer filters', () => {
  it('uses the API pagination defaults', () => {
    expect(customerFiltersFromParamMap(convertToParamMap({}))).toEqual({ page: 1, limit: 20 });
  });

  it('parses supported router query parameters', () => {
    expect(
      customerFiltersFromParamMap(
        convertToParamMap({ page: '2', limit: '50', activo: 'false', q: '  Ana   López  ' }),
      ),
    ).toEqual({ page: 2, limit: 50, activo: false, q: 'Ana López' });
  });

  it('falls back safely for invalid pagination and status values', () => {
    expect(
      customerFiltersFromParamMap(
        convertToParamMap({ page: '0', limit: '101', activo: 'unknown', q: '   ' }),
      ),
    ).toEqual({ page: 1, limit: 20 });
  });

  it('normalizes and bounds searches', () => {
    expect(normalizeCustomerSearch(`  Ana   ${'x'.repeat(300)}  `)).toHaveLength(254);
    expect(normalizeCustomerSearch('  Ana   María  ')).toBe('Ana María');
  });
});
