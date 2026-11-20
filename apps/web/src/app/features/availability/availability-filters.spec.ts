import { convertToParamMap } from '@angular/router';
import {
  availabilityFiltersFromParamMap,
  availabilityFiltersToQueryParams,
  browserTimeZoneLabel,
  isoToLocalDateTime,
  localDateTimeToIso,
} from './availability-filters';

const branchId = '11111111-1111-4111-8111-111111111111';

describe('availability filters', () => {
  it('parses a valid range, filters and pagination', () => {
    expect(
      availabilityFiltersFromParamMap(
        convertToParamMap({
          sucursalId: branchId,
          fechaInicio: '2026-12-10T16:00:00-07:00',
          fechaFin: '2026-12-12T16:00:00-07:00',
          talla: ' M ',
          color: ' Azul ',
          estadoOperativo: 'MANTENIMIENTO',
          page: '2',
          limit: '50',
        }),
      ),
    ).toEqual({
      sucursalId: branchId,
      fechaInicio: '2026-12-10T23:00:00.000Z',
      fechaFin: '2026-12-12T23:00:00.000Z',
      talla: 'M',
      color: 'Azul',
      estadoOperativo: 'MANTENIMIENTO',
      page: 2,
      limit: 50,
    });
  });

  it.each([
    {},
    { sucursalId: branchId, fechaInicio: '2026-12-10T16:00', fechaFin: '2026-12-11T16:00:00Z' },
    { sucursalId: branchId, fechaInicio: '2026-12-12T00:00:00Z', fechaFin: '2026-12-11T00:00:00Z' },
  ])('rejects an incomplete or invalid range', (params) => {
    expect(availabilityFiltersFromParamMap(convertToParamMap(params))).toBeNull();
  });

  it('serializes local date-time with an explicit UTC zone and reverses it', () => {
    const localValue = '2026-12-10T16:30';
    const iso = localDateTimeToIso(localValue);

    expect(iso).toMatch(/^2026-12-\d{2}T\d{2}:30:00\.000Z$/);
    expect(isoToLocalDateTime(iso!)).toBe(localValue);
    expect(browserTimeZoneLabel()).toMatch(/UTC[+-]\d{2}:\d{2}/);
  });

  it('builds only supported query parameters', () => {
    const params = availabilityFiltersToQueryParams({
      sucursalId: branchId,
      fechaInicio: '2026-12-10T23:00:00.000Z',
      fechaFin: '2026-12-12T23:00:00.000Z',
      estadoOperativo: 'DISPONIBLE',
      page: 1,
      limit: 20,
    });

    expect(params).toEqual(expect.objectContaining({ sucursalId: branchId, page: 1, limit: 20 }));
    expect(JSON.stringify(params)).not.toMatch(/empresaId|empresaSlug|schemaName/);
  });
});
