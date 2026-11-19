import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiClient } from '../../core/http/api-client.service';
import { CustomersApiService } from './customers-api.service';

describe('CustomersApiService', () => {
  const api = { get: vi.fn(() => of(undefined)) };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [CustomersApiService, { provide: ApiClient, useValue: api }],
    });
  });

  it('requests a paginated filtered list without tenant selectors', () => {
    TestBed.inject(CustomersApiService)
      .list({ page: 2, limit: 50, activo: true, q: 'Ana' })
      .subscribe();

    expect(api.get).toHaveBeenCalledWith('clientes', {
      params: { page: 2, limit: 50, activo: true, q: 'Ana' },
    });
    expect(JSON.stringify(api.get.mock.calls)).not.toMatch(/empresaId|empresaSlug|schemaName/);
  });

  it('requests detail by encoded identifier', () => {
    TestBed.inject(CustomersApiService).getById('customer/id').subscribe();

    expect(api.get).toHaveBeenCalledWith('clientes/customer%2Fid');
  });
});
