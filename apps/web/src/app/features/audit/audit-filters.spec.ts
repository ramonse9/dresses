import { convertToParamMap } from '@angular/router';
import {
  auditFiltersFromParamMap,
  auditFiltersToQueryParams,
  auditIsoToLocalDateTime,
  auditLocalDateTimeToIso,
} from './audit-filters';

describe('audit filters', () => {
  it('reads supported filters and normalizes identifiers', () => {
    expect(
      auditFiltersFromParamMap(
        convertToParamMap({
          page: '2',
          limit: '50',
          action: 'reservation.updated',
          resourceType: 'reservacion',
          resourceId: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA',
          actor: 'BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB',
          fechaDesde: '2026-11-20T15:00:00.000Z',
          fechaHasta: '2026-11-21T15:00:00.000Z',
          schemaName: 'tenant_ignored',
        }),
      ),
    ).toEqual({
      page: 2,
      limit: 50,
      action: 'reservation.updated',
      resourceType: 'reservacion',
      resourceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      actor: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      fechaDesde: '2026-11-20T15:00:00.000Z',
      fechaHasta: '2026-11-21T15:00:00.000Z',
    });
  });

  it('serializes only supported filters', () => {
    const params = auditFiltersToQueryParams({
      page: 1,
      limit: 20,
      action: 'customer.updated',
      actor: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    });
    expect(params).toEqual({
      page: 1,
      limit: 20,
      action: 'customer.updated',
      actor: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    });
    expect(JSON.stringify(params)).not.toMatch(/empresaId|empresaSlug|schemaName/);
  });

  it('converts local date controls to timezone-aware ISO values', () => {
    const iso = auditLocalDateTimeToIso('2026-11-24T09:30');
    expect(iso).toMatch(/Z$/);
    expect(auditIsoToLocalDateTime(iso || undefined)).toBe('2026-11-24T09:30');
    expect(auditLocalDateTimeToIso('invalid')).toBeNull();
  });
});
