import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';
import { TenantStore } from './tenant.store';

export const tenantGuard: CanActivateFn = () => {
  const tenantStore = inject(TenantStore);
  const router = inject(Router);

  return tenantStore.hasSelectedTenant() ? true : router.createUrlTree(['/seleccionar-empresa']);
};
