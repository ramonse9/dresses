import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import { TenantApiService } from './tenant-api.service';

describe('TenantApiService', () => {
  const api = {
    get: vi.fn(),
    post: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockReturnValue(of([]));
    api.post.mockReturnValue(
      of({ accessToken: 'tenant-token', tokenType: 'Bearer', expiresIn: 900 }),
    );
    TestBed.configureTestingModule({
      providers: [TenantApiService, { provide: ApiClient, useValue: api }],
    });
  });

  it('lists only companies available to the authenticated user', () => {
    TestBed.inject(TenantApiService).listCompanies().subscribe();

    expect(api.get).toHaveBeenCalledWith('auth/empresas', { withCredentials: true });
  });

  it('selects with empresaId as the only request field', () => {
    TestBed.inject(TenantApiService).selectCompany('empresa-1').subscribe();

    expect(api.post).toHaveBeenCalledWith(
      'auth/select-empresa',
      { empresaId: 'empresa-1' },
      { withCredentials: true },
    );
    expect(JSON.stringify(api.post.mock.calls[0])).not.toContain('schemaName');
  });
});
