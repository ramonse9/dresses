import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { tenantGuard } from './tenant.guard';
import { TenantStore } from './tenant.store';

describe('tenantGuard', () => {
  const selected = signal(false);
  const router = { createUrlTree: vi.fn(() => new UrlTree()) };

  beforeEach(() => {
    selected.set(false);
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: TenantStore, useValue: { hasSelectedTenant: selected.asReadonly() } },
        { provide: Router, useValue: router },
      ],
    });
  });

  it('allows access with a selected tenant', () => {
    selected.set(true);

    expect(TestBed.runInInjectionContext(() => tenantGuard({} as never, {} as never))).toBe(true);
  });

  it('redirects to company selection without a tenant', () => {
    const result = TestBed.runInInjectionContext(() => tenantGuard({} as never, {} as never));

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/seleccionar-empresa']);
  });
});
