import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, map, type Observable, of, switchMap, tap } from 'rxjs';
import { TenantStore } from '../tenant/tenant.store';
import { AuthStore } from './auth.store';

@Injectable({ providedIn: 'root' })
export class AuthLogoutService {
  private readonly authStore = inject(AuthStore);
  private readonly tenantStore = inject(TenantStore);
  private readonly router = inject(Router);

  logout(): Observable<void> {
    return this.authStore.logout().pipe(
      catchError(() => of(undefined)),
      tap(() => {
        this.tenantStore.clearTenant();
        this.authStore.clearSession();
      }),
      switchMap(() => from(this.router.navigateByUrl('/login'))),
      map(() => undefined),
    );
  }
}
