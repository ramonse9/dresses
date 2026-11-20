import { convertToParamMap } from '@angular/router';
import {
  normalizeReservationSearch,
  reservationFiltersFromParamMap,
  reservationFiltersToQueryParams,
  reservationIsoToLocalDateTime,
  reservationLocalDateTimeToIso,
} from './reservation-filters';
import { reservationStatusLabel } from './reservation-display';

const customerId = '11111111-1111-4111-8111-111111111111';
const branchId = '22222222-2222-4222-8222-222222222222';

describe('reservation filters', () => {
  it('parses every supported filter', () => {
    expect(
      reservationFiltersFromParamMap(
        convertToParamMap({
          page: '2',
          limit: '50',
          clienteId: customerId,
          sucursalId: branchId,
          estado: 'CONFIRMADA',
          fechaDesde: '2026-12-10T16:00:00-07:00',
          fechaHasta: '2026-12-12T16:00:00-07:00',
          q: '  Ana   López ',
        }),
      ),
    ).toEqual({
      page: 2,
      limit: 50,
      clienteId: customerId,
      sucursalId: branchId,
      estado: 'CONFIRMADA',
      fechaDesde: '2026-12-10T23:00:00.000Z',
      fechaHasta: '2026-12-12T23:00:00.000Z',
      q: 'Ana López',
    });
  });

  it('drops invalid identifiers, states and inverted ranges', () => {
    expect(
      reservationFiltersFromParamMap(
        convertToParamMap({
          clienteId: 'invalid',
          sucursalId: 'invalid',
          estado: 'PAGADA',
          fechaDesde: '2026-12-12T00:00:00Z',
          fechaHasta: '2026-12-10T00:00:00Z',
        }),
      ),
    ).toEqual({ page: 1, limit: 20 });
  });

  it('serializes local date-time with timezone and restores it', () => {
    const local = '2026-12-10T16:00';
    const iso = reservationLocalDateTimeToIso(local);
    expect(iso).toMatch(/Z$/);
    expect(reservationIsoToLocalDateTime(iso!)).toBe(local);
  });

  it('normalizes search and emits no tenant selectors', () => {
    expect(normalizeReservationSearch('  Ana   López  ')).toBe('Ana López');
    const params = reservationFiltersToQueryParams({ page: 1, limit: 20, q: 'Ana' });
    expect(params).toEqual({ page: 1, limit: 20, q: 'Ana' });
    expect(JSON.stringify(params)).not.toMatch(/empresaId|empresaSlug|schemaName/);
  });

  it.each([
    ['BORRADOR', 'Borrador'],
    ['CONFIRMADA', 'Confirmada'],
    ['ENTREGADA', 'Entregada'],
    ['DEVUELTA', 'Devuelta'],
    ['CANCELADA', 'Cancelada'],
  ] as const)('labels status %s', (status, label) => {
    expect(reservationStatusLabel(status)).toBe(label);
  });
});
