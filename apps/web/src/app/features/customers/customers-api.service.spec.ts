import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiClient } from '../../core/http/api-client.service';
import { CustomersApiService } from './customers-api.service';

describe('CustomersApiService', () => {
  const api = {
    get: vi.fn(() => of(undefined)),
    post: vi.fn(() => of(undefined)),
    patch: vi.fn(() => of(undefined)),
    delete: vi.fn(() => of(undefined)),
  };

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

  it('creates and updates customer data without sending activo', () => {
    const input = {
      nombre: 'Ana López',
      telefono: null,
      email: 'ana@example.com',
      direccion: null,
      notas: null,
    };
    const service = TestBed.inject(CustomersApiService);

    service.create(input).subscribe();
    service.update('customer/id', input).subscribe();

    expect(api.post).toHaveBeenCalledWith('clientes', input);
    expect(api.patch).toHaveBeenCalledWith('clientes/customer%2Fid', input);
    expect(JSON.stringify(input)).not.toContain('activo');
  });

  it('uses the dedicated state endpoint and DELETE for logical deactivation', () => {
    const service = TestBed.inject(CustomersApiService);

    service.updateStatus('customer/id', true).subscribe();
    service.deactivate('customer/id').subscribe();

    expect(api.patch).toHaveBeenCalledWith('clientes/customer%2Fid/estado', { activo: true });
    expect(api.delete).toHaveBeenCalledWith('clientes/customer%2Fid');
  });
});
