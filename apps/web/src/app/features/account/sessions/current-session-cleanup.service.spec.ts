import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthStore } from '../../../core/auth/auth.store';
import { TenantStore } from '../../../core/tenant/tenant.store';
import { CurrentSessionCleanupService } from './current-session-cleanup.service';

describe('CurrentSessionCleanupService', () => {
  const authStore = { clearSession: vi.fn() };
  const tenantStore = { clearTenant: vi.fn() };
  const router = { navigateByUrl: vi.fn(() => Promise.resolve(true)) };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        CurrentSessionCleanupService,
        { provide: AuthStore, useValue: authStore },
        { provide: TenantStore, useValue: tenantStore },
        { provide: Router, useValue: router },
      ],
    });
  });

  it('clears authentication, tenant state and feature stores before navigating', () => {
    TestBed.inject(CurrentSessionCleanupService).cleanupAndNavigateToLogin();

    expect(tenantStore.clearTenant).toHaveBeenCalledOnce();
    expect(authStore.clearSession).toHaveBeenCalledOnce();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
    expect(tenantStore.clearTenant.mock.invocationCallOrder[0]).toBeLessThan(
      authStore.clearSession.mock.invocationCallOrder[0],
    );
  });
});
