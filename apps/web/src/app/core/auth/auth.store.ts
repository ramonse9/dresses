import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, InjectionToken, signal } from '@angular/core';
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
  timeout,
} from 'rxjs';
import { normalizeApiError, type ApiError } from '../http/api-error';
import { AccessTokenStore } from './access-token.store';
import { AuthApiService } from './auth-api.service';
import type {
  AccessTokenResponse,
  AuthenticatedUser,
  AuthInitializationState,
  AuthSessionState,
  LoginCredentials,
} from './auth.models';

export const AUTH_INITIALIZATION_TIMEOUT_MS = new InjectionToken<number>(
  'AUTH_INITIALIZATION_TIMEOUT_MS',
  { providedIn: 'root', factory: () => 10_000 },
);

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly api = inject(AuthApiService);
  private readonly accessTokens = inject(AccessTokenStore);
  private readonly initializationTimeoutMs = inject(AUTH_INITIALIZATION_TIMEOUT_MS);
  private readonly statusValue = signal<AuthInitializationState>('initializing');
  private readonly userValue = signal<AuthenticatedUser | null>(null);
  private readonly expirationValue = signal<number | null>(null);
  private readonly initializationErrorValue = signal<ApiError | null>(null);
  private initializationInFlight: Observable<void> | null = null;
  private refreshInFlight: Observable<string> | null = null;

  readonly status = this.statusValue.asReadonly();
  readonly user = this.userValue.asReadonly();
  readonly accessTokenExpiresAt = this.expirationValue.asReadonly();
  readonly initializationError = this.initializationErrorValue.asReadonly();
  readonly session = computed<AuthSessionState>(() => ({
    status: this.statusValue(),
    user: this.userValue(),
    accessTokenExpiresAt: this.expirationValue(),
    initializationError: this.initializationErrorValue(),
  }));
  readonly isAuthenticated = computed(
    () => this.statusValue() === 'authenticated' && this.userValue() !== null,
  );
  readonly isInitializing = computed(() => this.statusValue() === 'initializing');

  initialize(): Observable<void> {
    if (this.initializationInFlight) {
      return this.initializationInFlight;
    }

    if (this.statusValue() !== 'initializing') {
      return of(undefined);
    }

    this.initializationErrorValue.set(null);
    this.initializationInFlight = this.refreshAccessToken().pipe(
      timeout({ first: this.initializationTimeoutMs }),
      map(() => undefined),
      catchError((error: unknown) => {
        this.clearSession();
        if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
          this.initializationErrorValue.set(normalizeApiError(error));
        }
        return of(undefined);
      }),
      finalize(() => {
        this.initializationInFlight = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    return this.initializationInFlight;
  }

  login(credentials: LoginCredentials): Observable<AuthenticatedUser> {
    this.clearSession();

    return this.api.login(credentials).pipe(
      switchMap((response) =>
        this.api.me().pipe(tap((user) => this.setAuthenticatedSession(response, user))),
      ),
      catchError((error: unknown) => {
        this.clearSession();
        return throwError(() => error);
      }),
    );
  }

  refreshAccessToken(): Observable<string> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.api.refresh().pipe(
        switchMap((response) =>
          this.api.me().pipe(
            tap((user) => this.setAuthenticatedSession(response, user)),
            map(() => response.accessToken),
          ),
        ),
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

  setAuthenticatedSession(response: AccessTokenResponse, user: AuthenticatedUser): void {
    this.accessTokens.set(response.accessToken);
    this.userValue.set(user);
    this.expirationValue.set(Date.now() + response.expiresIn * 1_000);
    this.initializationErrorValue.set(null);
    this.statusValue.set('authenticated');
  }

  clearSession(): void {
    this.accessTokens.clear();
    this.userValue.set(null);
    this.expirationValue.set(null);
    this.initializationErrorValue.set(null);
    this.statusValue.set('anonymous');
  }

  getAccessToken(): string | null {
    return this.accessTokens.token();
  }
}
