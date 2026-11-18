import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, map, Observable, of, switchMap, tap } from 'rxjs';
import { AuthStore } from './auth.store';

@Injectable({ providedIn: 'root' })
export class AuthLogoutService {
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  logout(): Observable<void> {
    return this.authStore.logout().pipe(
      catchError(() => of(undefined)),
      tap(() => this.authStore.clearSession()),
      switchMap(() => from(this.router.navigateByUrl('/login'))),
      map(() => undefined),
    );
  }
}
