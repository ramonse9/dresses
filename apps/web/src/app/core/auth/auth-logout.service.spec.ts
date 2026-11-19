import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom, of, throwError } from 'rxjs';
import { AuthLogoutService } from './auth-logout.service';
import { AuthStore } from './auth.store';
import { TenantStore } from '../tenant/tenant.store';

describe('AuthLogoutService', () => {
  const authStore = {
    logout: vi.fn(),
    clearSession: vi.fn(),
  };
  const router = {
    navigateByUrl: vi.fn(),
  };
  const tenantStore = {
    clearTenant: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    authStore.logout.mockReturnValue(of(undefined));
    router.navigateByUrl.mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        AuthLogoutService,
        { provide: AuthStore, useValue: authStore },
        { provide: TenantStore, useValue: tenantStore },
        { provide: Router, useValue: router },
      ],
    });
  });

  it('clears state and navigates after a successful logout', async () => {
    await firstValueFrom(TestBed.inject(AuthLogoutService).logout());

    expect(authStore.logout).toHaveBeenCalledOnce();
    expect(tenantStore.clearTenant).toHaveBeenCalledOnce();
    expect(authStore.clearSession).toHaveBeenCalledOnce();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('still clears state and navigates when logout fails', async () => {
    authStore.logout.mockReturnValueOnce(throwError(() => new Error('network error')));

    await firstValueFrom(TestBed.inject(AuthLogoutService).logout());

    expect(tenantStore.clearTenant).toHaveBeenCalledOnce();
    expect(authStore.clearSession).toHaveBeenCalledOnce();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });
});
