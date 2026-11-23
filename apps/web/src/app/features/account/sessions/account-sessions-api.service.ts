import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient } from '../../../core/http/api-client.service';
import type { AccountSession, RevokeOtherSessionsResponse } from './account-session.models';

@Injectable({ providedIn: 'root' })
export class AccountSessionsApiService {
  private readonly api = inject(ApiClient);

  list(): Observable<AccountSession[]> {
    return this.api.get<AccountSession[]>('auth/sessions', {
      params: { revoked: false, limit: 100 },
      withCredentials: true,
    });
  }

  revoke(id: string): Observable<void> {
    return this.api.delete<void>(`auth/sessions/${encodeURIComponent(id)}`, {
      withCredentials: true,
    });
  }

  revokeOthers(): Observable<RevokeOtherSessionsResponse> {
    return this.api.post<RevokeOtherSessionsResponse, Record<string, never>>(
      'auth/sessions/revocar-otras',
      {},
      { withCredentials: true },
    );
  }
}
