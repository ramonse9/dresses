import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiClient } from '../../core/http/api-client.service';
import { ReservationsApiService } from './reservations-api.service';

describe('ReservationsApiService', () => {
  const api = { get: vi.fn(() => of(undefined)) };
  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [ReservationsApiService, { provide: ApiClient, useValue: api }],
    });
  });

  it('requests the paginated list with supported filters', () => {
    const filters = {
      page: 2,
      limit: 50,
      clienteId: '11111111-1111-4111-8111-111111111111',
      sucursalId: '22222222-2222-4222-8222-222222222222',
      estado: 'CONFIRMADA' as const,
      fechaDesde: '2026-12-10T23:00:00.000Z',
      fechaHasta: '2026-12-12T23:00:00.000Z',
      q: 'Ana',
    };
    TestBed.inject(ReservationsApiService).list(filters).subscribe();
    expect(api.get).toHaveBeenCalledWith('reservaciones', { params: filters });
    expect(JSON.stringify(api.get.mock.calls)).not.toMatch(/schemaName|empresaSlug/);
  });

  it('requests detail with an encoded identifier', () => {
    TestBed.inject(ReservationsApiService).getById('reservation/id').subscribe();
    expect(api.get).toHaveBeenCalledWith('reservaciones/reservation%2Fid');
  });
});
