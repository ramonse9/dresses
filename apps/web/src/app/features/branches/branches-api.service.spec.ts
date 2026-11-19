import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiClient } from '../../core/http/api-client.service';
import { BranchesApiService } from './branches-api.service';

describe('BranchesApiService', () => {
  const api = {
    get: vi.fn(() => of(undefined)),
    post: vi.fn(() => of(undefined)),
    patch: vi.fn(() => of(undefined)),
    delete: vi.fn(() => of(undefined)),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [BranchesApiService, { provide: ApiClient, useValue: api }],
    });
  });

  it('requests the tenant-scoped branch list without selectors', () => {
    TestBed.inject(BranchesApiService).list().subscribe();

    expect(api.get).toHaveBeenCalledWith('sucursales');
    expect(JSON.stringify(api.get.mock.calls)).not.toMatch(/empresaId|empresaSlug|schemaName/);
  });

  it('requests one branch by encoded identifier', () => {
    TestBed.inject(BranchesApiService).getById('branch/id').subscribe();

    expect(api.get).toHaveBeenCalledWith('sucursales/branch%2Fid');
  });

  it('creates a branch without tenant selectors', () => {
    const input = { nombre: 'Centro', direccion: null, telefono: '555-0100' };

    TestBed.inject(BranchesApiService).create(input).subscribe();

    expect(api.post).toHaveBeenCalledWith('sucursales', input);
    expect(JSON.stringify(api.post.mock.calls)).not.toMatch(/empresaId|empresaSlug|schemaName/);
  });

  it('updates, reactivates and deactivates by identifier', () => {
    const service = TestBed.inject(BranchesApiService);
    const input = { nombre: 'Centro', direccion: null, telefono: null };

    service.update('branch/id', input).subscribe();
    service.update('branch/id', { activo: true }).subscribe();
    service.deactivate('branch/id').subscribe();

    expect(api.patch).toHaveBeenNthCalledWith(1, 'sucursales/branch%2Fid', input);
    expect(api.patch).toHaveBeenNthCalledWith(2, 'sucursales/branch%2Fid', { activo: true });
    expect(api.delete).toHaveBeenCalledWith('sucursales/branch%2Fid');
  });
});
