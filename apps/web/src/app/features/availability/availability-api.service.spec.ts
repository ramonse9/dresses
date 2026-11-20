import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiClient } from '../../core/http/api-client.service';
import { AvailabilityApiService } from './availability-api.service';

describe('AvailabilityApiService', () => {
  const api = { get: vi.fn(() => of(undefined)) };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [AvailabilityApiService, { provide: ApiClient, useValue: api }],
    });
  });

  it('requests availability with supported filters only', () => {
    const filters = {
      sucursalId: '11111111-1111-4111-8111-111111111111',
      fechaInicio: '2026-12-10T23:00:00.000Z',
      fechaFin: '2026-12-12T23:00:00.000Z',
      talla: 'M',
      color: 'Rojo',
      estadoOperativo: 'DISPONIBLE' as const,
      page: 1,
      limit: 20,
    };
    TestBed.inject(AvailabilityApiService).find(filters).subscribe();

    expect(api.get).toHaveBeenCalledWith('vestidos/disponibilidad', { params: filters });
    expect(JSON.stringify(api.get.mock.calls)).not.toMatch(/empresaId|empresaSlug|schemaName/);
  });
});
