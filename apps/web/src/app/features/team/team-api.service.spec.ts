import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiClient } from '../../core/http/api-client.service';
import { TeamApiService } from './team-api.service';

describe('TeamApiService', () => {
  const api = { get: vi.fn(() => of(undefined)), patch: vi.fn(() => of(undefined)) };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [TeamApiService, { provide: ApiClient, useValue: api }],
    });
  });

  it('requests the filtered list without tenant selectors', () => {
    TestBed.inject(TeamApiService)
      .list({ page: 2, limit: 50, rol: 'EMPLOYEE', activo: true, q: 'Ana' })
      .subscribe();

    expect(api.get).toHaveBeenCalledWith('equipo/miembros', {
      params: { page: 2, limit: 50, rol: 'EMPLOYEE', activo: true, q: 'Ana' },
    });
    expect(JSON.stringify(api.get.mock.calls)).not.toMatch(/empresaId|empresaSlug|schemaName/);
  });

  it('uses encoded membership identifiers for detail and mutations', () => {
    const service = TestBed.inject(TeamApiService);
    service.getById('member/id').subscribe();
    service.updateRole('member/id', 'OWNER').subscribe();
    service.updateStatus('member/id', false).subscribe();

    expect(api.get).toHaveBeenCalledWith('equipo/miembros/member%2Fid');
    expect(api.patch).toHaveBeenCalledWith('equipo/miembros/member%2Fid/rol', { rol: 'OWNER' });
    expect(api.patch).toHaveBeenCalledWith('equipo/miembros/member%2Fid/estado', {
      activo: false,
    });
  });
});
