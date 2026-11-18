import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  catchError,
  finalize,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { normalizeApiError, type ApiError } from '../http/api-error';
import { AccessTokenStore } from './access-token.store';
import { AuthApiService } from './auth-api.service';
import type { AuthenticatedUser, AuthStatus, LoginCredentials } from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthStateService {
  private readonly api = inject(AuthApiService);
  private readonly accessTokens = inject(AccessTokenStore);
  private readonly statusValue = signal<AuthStatus>('checking');
  private readonly userValue = signal<AuthenticatedUser | null>(null);
  private readonly errorValue = signal<ApiError | null>(null);
  private refreshInFlight: Observable<string> | null = null;

  readonly status = this.statusValue.asReadonly();
  readonly user = this.userValue.asReadonly();
  readonly error = this.errorValue.asReadonly();
  readonly isAuthenticated = computed(
    () => this.statusValue() === 'authenticated' && this.userValue() !== null,
  );
  readonly isChecking = computed(() => this.statusValue() === 'checking');

  restoreSession(): Observable<void> {
    this.statusValue.set('checking');
    this.errorValue.set(null);

    return this.refreshAccessToken().pipe(
      map(() => undefined),
      catchError((error: unknown) => {
        if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
          this.errorValue.set(normalizeApiError(error));
        }
        return of(undefined);
      }),
    );
  }

  login(credentials: LoginCredentials): Observable<AuthenticatedUser> {
    this.clearSession();
    this.statusValue.set('checking');

    return this.establishSession(this.api.login(credentials)).pipe(
      catchError((error: unknown) => {
        this.clearSession();
        this.errorValue.set(normalizeApiError(error));
        return throwError(() => error);
      }),
    );
  }

  refreshAccessToken(): Observable<string> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.establishSession(this.api.refresh()).pipe(
        map(() => {
          const accessToken = this.accessTokens.token();
          if (!accessToken) {
            throw new Error('El access token no fue establecido.');
          }
          return accessToken;
        }),
        catchError((error: unknown) => {
          this.clearSession();
          return throwError(() => error);
        }),
        finalize(() => {
          this.refreshInFlight = null;
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }

    return this.refreshInFlight;
  }

  logout(): Observable<void> {
    return this.api.logout().pipe(finalize(() => this.clearSession()));
  }

  clearSession(): void {
    this.accessTokens.clear();
    this.userValue.set(null);
    this.errorValue.set(null);
    this.statusValue.set('anonymous');
  }

  private establishSession(
    accessTokenRequest: Observable<{ readonly accessToken: string }>,
  ): Observable<AuthenticatedUser> {
    return accessTokenRequest.pipe(
      tap(({ accessToken }) => this.accessTokens.set(accessToken)),
      switchMap(() => this.api.me()),
      tap((user) => {
        this.userValue.set(user);
        this.statusValue.set('authenticated');
        this.errorValue.set(null);
      }),
    );
  }
}
