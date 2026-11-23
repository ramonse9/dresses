import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiClient } from '../../../core/http/api-client.service';
import { AccountSessionsApiService } from './account-sessions-api.service';

describe('AccountSessionsApiService', () => {
  const api = {
    get: vi.fn(() => of([])),
    delete: vi.fn(() => of(undefined)),
    post: vi.fn(() => of({ revokedCount: 0 })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [AccountSessionsApiService, { provide: ApiClient, useValue: api }],
    });
  });

  it('lists bounded active sessions without tenant selectors', () => {
    TestBed.inject(AccountSessionsApiService).list().subscribe();

    expect(api.get).toHaveBeenCalledWith('auth/sessions', {
      params: { revoked: false, limit: 100 },
      withCredentials: true,
    });
    expect(JSON.stringify(api.get.mock.calls)).not.toMatch(/empresaId|empresaSlug|schemaName/);
  });

  it('revokes one session and all other sessions with credentials', () => {
    const service = TestBed.inject(AccountSessionsApiService);
    service.revoke('session/id').subscribe();
    service.revokeOthers().subscribe();

    expect(api.delete).toHaveBeenCalledWith('auth/sessions/session%2Fid', {
      withCredentials: true,
    });
    expect(api.post).toHaveBeenCalledWith(
      'auth/sessions/revocar-otras',
      {},
      { withCredentials: true },
    );
  });
});
