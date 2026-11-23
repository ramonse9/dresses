import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import { AuthStore } from '../auth/auth.store';
import { TenantApiService } from './tenant-api.service';
import type { AvailableCompany } from './tenant.models';
import { TenantPreferenceService } from './tenant-preference.service';
import { TenantResetRegistry } from './tenant-reset-registry.service';
import { TenantStore } from './tenant.store';

const ownerCompany: AvailableCompany = {
  id: 'empresa-owner',
  nombre: 'Atelier Norte',
  slug: 'atelier-norte',
  rol: 'OWNER',
};
const employeeCompany: AvailableCompany = {
  id: 'empresa-employee',
  nombre: 'Atelier Sur',
  slug: 'atelier-sur',
  rol: 'EMPLOYEE',
};
const tenantToken = { accessToken: 'tenant-token', tokenType: 'Bearer' as const, expiresIn: 900 };

describe('TenantStore', () => {
  const authenticated = signal(true);
  const user = signal({ sub: 'user-1', email: 'owner@example.com', sessionId: 'session-1' });
  const api = {
    listCompanies: vi.fn(),
    selectCompany: vi.fn(),
  };
  const authStore = {
    isAuthenticated: authenticated.asReadonly(),
    user: user.asReadonly(),
    setAuthenticatedSession: vi.fn(),
  };
  const preference = {
    readCompanyId: vi.fn(),
    writeCompanyId: vi.fn(),
    clearCompanyId: vi.fn(),
  };
  const resetRegistry = { resetAll: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    authenticated.set(true);
    api.listCompanies.mockReturnValue(of([]));
    api.selectCompany.mockReturnValue(of(tenantToken));
    preference.readCompanyId.mockReturnValue(null);
    TestBed.configureTestingModule({
      providers: [
        TenantStore,
        { provide: TenantApiService, useValue: api },
        { provide: AuthStore, useValue: authStore },
        { provide: TenantPreferenceService, useValue: preference },
        { provide: TenantResetRegistry, useValue: resetRegistry },
      ],
    });
  });

  it('shows an informative empty state when the user has no companies', async () => {
    const store = TestBed.inject(TenantStore);

    await firstValueFrom(store.initialize());

    expect(store.status()).toBe('empty');
    expect(store.companies()).toEqual([]);
    expect(preference.clearCompanyId).toHaveBeenCalledOnce();
  });

  it('automatically selects the only available company', async () => {
    api.listCompanies.mockReturnValue(of([ownerCompany]));
    const store = TestBed.inject(TenantStore);

    await firstValueFrom(store.initialize());

    expect(api.selectCompany).toHaveBeenCalledWith(ownerCompany.id);
    expect(authStore.setAuthenticatedSession).toHaveBeenCalledWith(tenantToken, user());
    expect(store.selectedCompany()).toEqual(ownerCompany);
    expect(store.role()).toBe('OWNER');
  });

  it('waits for selection when multiple companies are available', async () => {
    api.listCompanies.mockReturnValue(of([ownerCompany, employeeCompany]));
    const store = TestBed.inject(TenantStore);

    await firstValueFrom(store.initialize());

    expect(api.selectCompany).not.toHaveBeenCalled();
    expect(store.status()).toBe('ready');
    expect(store.hasSelectedTenant()).toBe(false);
  });

  it('reselects a remembered company only after validating the backend list', async () => {
    preference.readCompanyId.mockReturnValue(employeeCompany.id);
    api.listCompanies.mockReturnValue(of([ownerCompany, employeeCompany]));
    const store = TestBed.inject(TenantStore);

    await firstValueFrom(store.initialize());

    expect(api.selectCompany).toHaveBeenCalledWith(employeeCompany.id);
    expect(store.companyId()).toBe(employeeCompany.id);
    expect(preference.writeCompanyId).toHaveBeenCalledWith(employeeCompany.id);
  });

  it('ignores a remembered identifier absent from the current backend list', async () => {
    preference.readCompanyId.mockReturnValue('empresa-revocada');
    api.listCompanies.mockReturnValue(of([ownerCompany, employeeCompany]));
    const store = TestBed.inject(TenantStore);

    await firstValueFrom(store.initialize());

    expect(api.selectCompany).not.toHaveBeenCalled();
    expect(store.companies()).toEqual([ownerCompany, employeeCompany]);
  });

  it('removes a remembered company rejected by the backend', async () => {
    preference.readCompanyId.mockReturnValue(ownerCompany.id);
    api.listCompanies.mockReturnValue(of([ownerCompany, employeeCompany]));
    api.selectCompany.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 403, statusText: 'Forbidden' })),
    );
    const store = TestBed.inject(TenantStore);

    await firstValueFrom(store.initialize());

    expect(store.companies()).toEqual([employeeCompany]);
    expect(store.status()).toBe('ready');
    expect(preference.clearCompanyId).toHaveBeenCalledOnce();
  });

  it('clears registered feature state before changing company', async () => {
    api.listCompanies.mockReturnValue(of([ownerCompany, employeeCompany]));
    const store = TestBed.inject(TenantStore);
    await firstValueFrom(store.initialize());
    await firstValueFrom(store.selectCompany(ownerCompany.id));

    await firstValueFrom(store.selectCompany(employeeCompany.id));

    expect(resetRegistry.resetAll).toHaveBeenCalledOnce();
    expect(store.selectedCompany()).toEqual(employeeCompany);
    expect(store.role()).toBe('EMPLOYEE');
  });

  it('clears registered feature state even when no tenant is selected', () => {
    const store = TestBed.inject(TenantStore);

    store.clearTenant();

    expect(resetRegistry.resetAll).toHaveBeenCalledOnce();
    expect(store.hasSelectedTenant()).toBe(false);
  });

  it('invalidates the current tenant when a refreshed membership list removes it', async () => {
    api.listCompanies.mockReturnValueOnce(of([ownerCompany, employeeCompany]));
    const store = TestBed.inject(TenantStore);
    await firstValueFrom(store.initialize());
    await firstValueFrom(store.selectCompany(ownerCompany.id));
    vi.clearAllMocks();
    api.listCompanies.mockReturnValueOnce(of([]));

    await firstValueFrom(store.reloadCompanies());

    expect(store.hasSelectedTenant()).toBe(false);
    expect(store.status()).toBe('empty');
    expect(resetRegistry.resetAll).toHaveBeenCalledOnce();
  });

  it('deduplicates concurrent initialization calls', async () => {
    const response = new Subject<AvailableCompany[]>();
    api.listCompanies.mockReturnValue(response.asObservable());
    const store = TestBed.inject(TenantStore);

    const first = firstValueFrom(store.initialize());
    const second = firstValueFrom(store.initialize());
    response.next([ownerCompany, employeeCompany]);
    response.complete();
    await Promise.all([first, second]);

    expect(api.listCompanies).toHaveBeenCalledOnce();
  });

  it('does not load tenant data for an anonymous session', async () => {
    authenticated.set(false);
    const store = TestBed.inject(TenantStore);

    await firstValueFrom(store.initialize());

    expect(api.listCompanies).not.toHaveBeenCalled();
    expect(store.status()).toBe('idle');
  });

  it('does not expose internal schema information in its public state', async () => {
    api.listCompanies.mockReturnValue(of([ownerCompany, employeeCompany]));
    const store = TestBed.inject(TenantStore);
    await firstValueFrom(store.initialize());

    expect(
      JSON.stringify({ companies: store.companies(), selected: store.selectedTenant() }),
    ).not.toContain('schemaName');
  });
});
