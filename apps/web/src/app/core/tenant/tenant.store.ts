import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import {
  catchError,
  finalize,
  map,
  type Observable,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { AuthStore } from '../auth/auth.store';
import { normalizeApiError, type ApiError } from '../http/api-error';
import { TenantApiService } from './tenant-api.service';
import type {
  AvailableCompany,
  EmpresaRole,
  SelectedTenantSession,
  TenantLoadState,
} from './tenant.models';
import { TenantPreferenceService } from './tenant-preference.service';
import { TenantResetRegistry } from './tenant-reset-registry.service';

@Injectable({ providedIn: 'root' })
export class TenantStore {
  private readonly api = inject(TenantApiService);
  private readonly authStore = inject(AuthStore);
  private readonly preference = inject(TenantPreferenceService);
  private readonly resetRegistry = inject(TenantResetRegistry);
  private readonly companiesValue = signal<AvailableCompany[]>([]);
  private readonly selectedTenantValue = signal<SelectedTenantSession | null>(null);
  private readonly statusValue = signal<TenantLoadState>('idle');
  private readonly errorValue = signal<ApiError | null>(null);
  private initializationInFlight: Observable<void> | null = null;
  private initialized = false;
  private initializedSessionId: string | null = null;

  readonly companies = this.companiesValue.asReadonly();
  readonly selectedTenant = this.selectedTenantValue.asReadonly();
  readonly status = this.statusValue.asReadonly();
  readonly error = this.errorValue.asReadonly();
  readonly selectedCompany = computed(() => this.selectedTenantValue()?.empresa ?? null);
  readonly companyId = computed(() => this.selectedTenantValue()?.empresaId ?? null);
  readonly role = computed<EmpresaRole | null>(() => this.selectedTenantValue()?.rol ?? null);
  readonly loading = computed(() => ['loading', 'selecting'].includes(this.statusValue()));
  readonly hasSelectedTenant = computed(() => this.selectedTenantValue() !== null);

  initialize(): Observable<void> {
    if (this.initializationInFlight) {
      return this.initializationInFlight;
    }

    const authenticatedUser = this.authStore.user();
    if (!this.authStore.isAuthenticated() || !authenticatedUser) {
      this.clearRuntimeState();
      return of(undefined);
    }

    if (this.initialized && this.initializedSessionId === authenticatedUser.sessionId) {
      return of(undefined);
    }

    if (this.initializedSessionId && this.initializedSessionId !== authenticatedUser.sessionId) {
      this.clearTenant();
    }

    this.statusValue.set('loading');
    this.errorValue.set(null);
    this.initializationInFlight = this.api.listCompanies().pipe(
      tap((companies) => {
        this.companiesValue.set(companies);
        this.reconcileSelectedTenant(companies);
      }),
      switchMap((companies) => {
        if (companies.length === 0) {
          this.preference.clearCompanyId();
          this.statusValue.set('empty');
          return of(undefined);
        }

        const rememberedId = this.preference.readCompanyId();
        const rememberedCompany = companies.find(({ id }) => id === rememberedId);
        const companyToSelect = rememberedCompany ?? (companies.length === 1 ? companies[0] : null);

        if (!companyToSelect) {
          this.statusValue.set('ready');
          return of(undefined);
        }

        return this.selectCompany(companyToSelect.id).pipe(
          map(() => undefined),
          catchError((error: unknown) => {
            if (isAccessRevoked(error)) {
              return of(undefined);
            }
            return throwError(() => error);
          }),
        );
      }),
      catchError((error: unknown) => {
        this.errorValue.set(normalizeApiError(error));
        this.statusValue.set('error');
        return of(undefined);
      }),
      tap(() => {
        this.initialized = true;
        this.initializedSessionId = authenticatedUser.sessionId;
      }),
      finalize(() => {
        this.initializationInFlight = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    return this.initializationInFlight;
  }

  reloadCompanies(): Observable<void> {
    this.initialized = false;
    return this.initialize();
  }

  selectCompany(empresaId: string): Observable<SelectedTenantSession> {
    const company = this.companiesValue().find(({ id }) => id === empresaId);
    if (!company) {
      return throwError(() => new Error('La empresa seleccionada no está disponible.'));
    }

    const previousTenant = this.selectedTenantValue();
    this.statusValue.set('selecting');
    this.errorValue.set(null);

    return this.api.selectCompany(company.id).pipe(
      map((response) => {
        const user = this.authStore.user();
        if (!user) {
          throw new Error('La sesión autenticada ya no está disponible.');
        }

        if (previousTenant && previousTenant.empresaId !== company.id) {
          this.resetRegistry.resetAll();
        }

        const session: SelectedTenantSession = {
          empresa: company,
          empresaId: company.id,
          rol: company.rol,
        };
        this.authStore.setAuthenticatedSession(response, user);
        this.selectedTenantValue.set(session);
        this.preference.writeCompanyId(company.id);
        this.statusValue.set('ready');
        return session;
      }),
      catchError((error: unknown) => {
        if (isAccessRevoked(error)) {
          if (previousTenant?.empresaId === company.id) {
            this.resetRegistry.resetAll();
            this.selectedTenantValue.set(null);
          }
          this.removeRejectedCompany(company.id);
        } else {
          this.errorValue.set(normalizeApiError(error));
          this.statusValue.set(previousTenant ? 'ready' : 'error');
        }
        return throwError(() => error);
      }),
    );
  }

  clearTenant(options: { readonly forgetPreference?: boolean } = {}): void {
    this.resetRegistry.resetAll();
    if (options.forgetPreference) {
      this.preference.clearCompanyId();
    }
    this.clearRuntimeState();
  }

  private removeRejectedCompany(empresaId: string): void {
    const companies = this.companiesValue().filter(({ id }) => id !== empresaId);
    this.companiesValue.set(companies);
    if (this.preference.readCompanyId() === empresaId) {
      this.preference.clearCompanyId();
    }
    this.errorValue.set(null);
    this.statusValue.set(companies.length === 0 ? 'empty' : 'ready');
  }

  private reconcileSelectedTenant(companies: readonly AvailableCompany[]): void {
    const selectedTenant = this.selectedTenantValue();
    if (selectedTenant && !companies.some(({ id }) => id === selectedTenant.empresaId)) {
      this.resetRegistry.resetAll();
      this.selectedTenantValue.set(null);
    }
  }

  private clearRuntimeState(): void {
    this.companiesValue.set([]);
    this.selectedTenantValue.set(null);
    this.statusValue.set('idle');
    this.errorValue.set(null);
    this.initialized = false;
    this.initializedSessionId = null;
    this.initializationInFlight = null;
  }
}

function isAccessRevoked(error: unknown): boolean {
  return error instanceof HttpErrorResponse && [401, 403, 404].includes(error.status);
}
