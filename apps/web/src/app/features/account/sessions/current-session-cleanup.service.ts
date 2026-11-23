import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '../../../core/auth/auth.store';
import { TenantStore } from '../../../core/tenant/tenant.store';

@Injectable({ providedIn: 'root' })
export class CurrentSessionCleanupService {
  private readonly authStore = inject(AuthStore);
  private readonly tenantStore = inject(TenantStore);
  private readonly router = inject(Router);

  cleanupAndNavigateToLogin(): void {
    this.tenantStore.clearTenant();
    this.authStore.clearSession();
    void this.router.navigateByUrl('/login');
  }
}
