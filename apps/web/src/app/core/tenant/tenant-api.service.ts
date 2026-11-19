import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type { AccessTokenResponse } from '../auth/auth.models';
import { ApiClient } from '../http/api-client.service';
import type { AvailableCompany } from './tenant.models';

const cookieRequest = { withCredentials: true } as const;

@Injectable({ providedIn: 'root' })
export class TenantApiService {
  private readonly api = inject(ApiClient);

  listCompanies(): Observable<AvailableCompany[]> {
    return this.api.get<AvailableCompany[]>('auth/empresas', cookieRequest);
  }

  selectCompany(empresaId: string): Observable<AccessTokenResponse> {
    return this.api.post<AccessTokenResponse, { readonly empresaId: string }>(
      'auth/select-empresa',
      { empresaId },
      cookieRequest,
    );
  }
}
