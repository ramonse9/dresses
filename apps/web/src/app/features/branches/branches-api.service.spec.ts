import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiClient } from '../../core/http/api-client.service';
import { BranchesApiService } from './branches-api.service';

describe('BranchesApiService', () => {
  const api = { get: vi.fn(() => of(undefined)) };

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
});
