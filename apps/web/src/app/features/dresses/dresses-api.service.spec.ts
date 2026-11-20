import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiClient } from '../../core/http/api-client.service';
import { DressesApiService } from './dresses-api.service';

describe('DressesApiService', () => {
  const api = {
    get: vi.fn(() => of(undefined)),
    post: vi.fn(() => of(undefined)),
    patch: vi.fn(() => of(undefined)),
    delete: vi.fn(() => of(undefined)),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [DressesApiService, { provide: ApiClient, useValue: api }],
    });
  });

  it('requests the paginated catalog with supported filters', () => {
    const filters = {
      page: 2,
      limit: 50,
      sucursalId: '11111111-1111-4111-8111-111111111111',
      activo: true,
      estadoOperativo: 'DISPONIBLE' as const,
      q: 'Gala',
    };

    TestBed.inject(DressesApiService).list(filters).subscribe();

    expect(api.get).toHaveBeenCalledWith('vestidos', { params: filters });
    expect(JSON.stringify(api.get.mock.calls)).not.toMatch(/empresaId|empresaSlug|schemaName/);
  });

  it('requests detail with an encoded identifier', () => {
    TestBed.inject(DressesApiService).getById('dress/id').subscribe();

    expect(api.get).toHaveBeenCalledWith('vestidos/dress%2Fid');
  });

  it('uses the mutation contracts without tenant selectors', () => {
    const service = TestBed.inject(DressesApiService);
    const input = {
      sucursalId: 'branch-1',
      codigo: 'GALA-001',
      nombre: 'Gala',
      descripcion: null,
      talla: 'M',
      color: 'Rojo',
      marca: null,
      precioRenta: '1200.00',
      deposito: null,
      estadoOperativo: 'DISPONIBLE' as const,
    };
    service.create(input).subscribe();
    service.update('dress/id', { ...input, activo: true }).subscribe();
    service.deactivate('dress/id').subscribe();

    expect(api.post).toHaveBeenCalledWith('vestidos', input);
    expect(api.patch).toHaveBeenCalledWith('vestidos/dress%2Fid', { ...input, activo: true });
    expect(api.delete).toHaveBeenCalledWith('vestidos/dress%2Fid');
    expect(JSON.stringify([api.post.mock.calls, api.patch.mock.calls])).not.toMatch(
      /schemaName|empresaId/,
    );
  });
});
