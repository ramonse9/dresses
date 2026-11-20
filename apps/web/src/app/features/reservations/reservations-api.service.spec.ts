import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiClient } from '../../core/http/api-client.service';
import { ReservationsApiService } from './reservations-api.service';

describe('ReservationsApiService', () => {
  const api = {
    get: vi.fn(() => of(undefined)),
    post: vi.fn(() => of(undefined)),
    patch: vi.fn(() => of(undefined)),
  };
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

  it('creates a reservation using only the backend-owned contract', () => {
    const input = {
      clienteId: '11111111-1111-4111-8111-111111111111',
      sucursalId: '22222222-2222-4222-8222-222222222222',
      vestidoIds: ['33333333-3333-4333-8333-333333333333'],
      fechaInicio: '2026-12-10T23:00:00.000Z',
      fechaFin: '2026-12-12T23:00:00.000Z',
      notas: null,
      confirmar: true,
    };

    TestBed.inject(ReservationsApiService).create(input).subscribe();

    expect(api.post).toHaveBeenCalledWith('reservaciones', input);
    expect(JSON.stringify(api.post.mock.calls)).not.toMatch(
      /importe|total|estado|empresaId|empresaSlug|schemaName/,
    );
  });

  it('updates only editable reservation fields', () => {
    const input = {
      clienteId: '11111111-1111-4111-8111-111111111111',
      sucursalId: '22222222-2222-4222-8222-222222222222',
      vestidoIds: ['33333333-3333-4333-8333-333333333333'],
      fechaInicio: '2026-12-10T23:00:00.000Z',
      fechaFin: '2026-12-12T23:00:00.000Z',
      notas: null,
    };
    TestBed.inject(ReservationsApiService).update('reservation/id', input).subscribe();
    expect(api.patch).toHaveBeenCalledWith('reservaciones/reservation%2Fid', input);
    expect(JSON.stringify(api.patch.mock.calls)).not.toMatch(
      /importe|total|estado|empresaId|empresaSlug|schemaName/,
    );
  });

  it.each([
    ['confirm', 'confirmar'],
    ['deliver', 'entregar'],
    ['returnReservation', 'devolver'],
  ] as const)('uses the explicit %s transition endpoint', (method, path) => {
    TestBed.inject(ReservationsApiService)[method]('reservation/id').subscribe();
    expect(api.post).toHaveBeenCalledWith(`reservaciones/reservation%2Fid/${path}`, null);
  });

  it('sends only the optional cancellation reason', () => {
    TestBed.inject(ReservationsApiService)
      .cancel('reservation/id', { motivo: 'Cambio de evento' })
      .subscribe();
    expect(api.post).toHaveBeenCalledWith('reservaciones/reservation%2Fid/cancelar', {
      motivo: 'Cambio de evento',
    });
  });
});
