import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import { AccessTokenStore } from '../auth/access-token.store';
import { AuthApiService } from '../auth/auth-api.service';
import { authInterceptor } from '../auth/auth.interceptor';
import type { AccessTokenResponse, AuthenticatedUser } from '../auth/auth.models';
import { AuthStore } from '../auth/auth.store';
import { API_BASE_URL } from '../config/api-config';
import { TenantApiService } from '../tenant/tenant-api.service';
import type { AvailableCompany } from '../tenant/tenant.models';
import { TenantPreferenceService } from '../tenant/tenant-preference.service';
import { TenantResetRegistry } from '../tenant/tenant-reset-registry.service';
import { TenantStore } from '../tenant/tenant.store';

const user: AuthenticatedUser = {
  sub: '11111111-1111-4111-8111-111111111111',
  email: 'owner@example.test',
  sessionId: '22222222-2222-4222-8222-222222222222',
};
const currentToken: AccessTokenResponse = {
  accessToken: 'current.jwt.token',
  tokenType: 'Bearer',
  expiresIn: 900,
};
const refreshedToken: AccessTokenResponse = {
  accessToken: 'refreshed.jwt.token',
  tokenType: 'Bearer',
  expiresIn: 900,
};

describe('frontend authentication integration', () => {
  const api = {
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
  };
  let http: HttpClient;
  let controller: HttpTestingController;
  let authStore: AuthStore;

  beforeEach(() => {
    vi.clearAllMocks();
    api.me.mockReturnValue(of(user));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        AuthStore,
        AccessTokenStore,
        { provide: API_BASE_URL, useValue: 'http://localhost:3000/api' },
        { provide: AuthApiService, useValue: api },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    authStore = TestBed.inject(AuthStore);
    authStore.setAuthenticatedSession(currentToken, user);
  });

  afterEach(() => controller.verify());

  it('shares one refresh across concurrent 401 responses and retries each request once', async () => {
    const refresh = new Subject<AccessTokenResponse>();
    api.refresh.mockReturnValue(refresh.asObservable());
    const customers = firstValueFrom(http.get('http://localhost:3000/api/clientes'));
    const dresses = firstValueFrom(http.get('http://localhost:3000/api/vestidos'));

    controller
      .expectOne('http://localhost:3000/api/clientes')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    controller
      .expectOne('http://localhost:3000/api/vestidos')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(api.refresh).toHaveBeenCalledOnce();

    refresh.next(refreshedToken);
    refresh.complete();
    const customerRetry = controller.expectOne('http://localhost:3000/api/clientes');
    const dressRetry = controller.expectOne('http://localhost:3000/api/vestidos');
    expect(customerRetry.request.headers.get('Authorization')).toBe(
      `Bearer ${refreshedToken.accessToken}`,
    );
    expect(dressRetry.request.headers.get('Authorization')).toBe(
      `Bearer ${refreshedToken.accessToken}`,
    );
    customerRetry.flush([]);
    dressRetry.flush([]);

    await expect(Promise.all([customers, dresses])).resolves.toEqual([[], []]);
    expect(api.me).toHaveBeenCalledOnce();
  });

  it('clears the in-memory session when the user or session is revoked', async () => {
    api.refresh.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' })),
    );
    const response = firstValueFrom(http.get('http://localhost:3000/api/reservaciones'));
    controller
      .expectOne('http://localhost:3000/api/reservaciones')
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    await expect(response).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(authStore.status()).toBe('anonymous');
    expect(authStore.getAccessToken()).toBeNull();
  });
});

describe('frontend tenant revocation integration', () => {
  const owner: AvailableCompany = {
    id: 'empresa-owner',
    nombre: 'Atelier Norte',
    slug: 'atelier-norte',
    rol: 'OWNER',
  };
  const employee: AvailableCompany = {
    id: 'empresa-employee',
    nombre: 'Atelier Sur',
    slug: 'atelier-sur',
    rol: 'EMPLOYEE',
  };
  const api = { listCompanies: vi.fn(), selectCompany: vi.fn() };
  const resetRegistry = { resetAll: vi.fn() };
  const preference = {
    readCompanyId: vi.fn(() => null),
    writeCompanyId: vi.fn(),
    clearCompanyId: vi.fn(),
  };
  const authenticated = signal(true);
  const authStore = {
    isAuthenticated: authenticated.asReadonly(),
    user: signal(user).asReadonly(),
    setAuthenticatedSession: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.listCompanies.mockReturnValue(of([owner, employee]));
    api.selectCompany.mockReturnValue(of(refreshedToken));
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

  it.each([403, 404])(
    'removes a membership or company rejected with %s without exposing schema data',
    async (status) => {
      const store = TestBed.inject(TenantStore);
      await firstValueFrom(store.initialize());
      api.selectCompany.mockReturnValueOnce(
        throwError(() => new HttpErrorResponse({ status, statusText: 'Forbidden' })),
      );

      await expect(firstValueFrom(store.selectCompany(owner.id))).rejects.toBeInstanceOf(
        HttpErrorResponse,
      );
      expect(store.companies()).toEqual([employee]);
      expect(JSON.stringify(store.companies())).not.toContain('schemaName');
    },
  );

  it('clears every registered feature before changing tenant', async () => {
    const store = TestBed.inject(TenantStore);
    await firstValueFrom(store.initialize());
    await firstValueFrom(store.selectCompany(owner.id));
    await firstValueFrom(store.selectCompany(employee.id));
    expect(resetRegistry.resetAll).toHaveBeenCalledOnce();
    expect(store.selectedCompany()).toEqual(employee);
  });
});
