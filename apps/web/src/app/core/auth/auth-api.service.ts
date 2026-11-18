import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import type { AccessTokenResponse, AuthenticatedUser, LoginCredentials } from './auth.models';

const cookieRequest = { withCredentials: true } as const;

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly api = inject(ApiClient);

  login(credentials: LoginCredentials): Observable<AccessTokenResponse> {
    return this.api.post<AccessTokenResponse, LoginCredentials>(
      'auth/login',
      credentials,
      cookieRequest,
    );
  }

  refresh(): Observable<AccessTokenResponse> {
    return this.api.post<AccessTokenResponse, null>('auth/refresh', null, cookieRequest);
  }

  logout(): Observable<void> {
    return this.api.post<void, null>('auth/logout', null, cookieRequest);
  }

  me(): Observable<AuthenticatedUser> {
    return this.api.get<AuthenticatedUser>('auth/me', cookieRequest);
  }
}
