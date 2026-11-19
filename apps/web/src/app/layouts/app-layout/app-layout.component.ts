import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthLogoutService } from '../../core/auth/auth-logout.service';
import { AuthStore } from '../../core/auth/auth.store';
import { TenantStore } from '../../core/tenant/tenant.store';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterLink, RouterOutlet],
  template: `
    <div class="min-h-screen bg-stone-100 text-stone-950">
      <header class="border-b border-stone-200 bg-white">
        <div class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4 lg:px-8">
          <div>
            <p class="font-serif text-xl">Atelier</p>
            @if (authStore.user(); as user) {
              <p class="text-sm text-stone-500">{{ user.email }}</p>
            }
            @if (tenantStore.selectedCompany(); as company) {
              <p class="mt-1 text-sm font-semibold text-rose-700">
                {{ company.nombre }} ·
                {{ tenantStore.role() === 'OWNER' ? 'Propietario' : 'Empleado' }}
              </p>
            }
          </div>
          <div class="flex flex-wrap items-center justify-end gap-3">
            <a
              routerLink="/seleccionar-empresa"
              [queryParams]="{ change: true }"
              class="inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-rose-600 focus:ring-offset-2"
            >
              Cambiar empresa
            </a>
            <button
              type="button"
              class="min-h-11 rounded-full border border-stone-300 px-5 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-rose-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              [disabled]="loggingOut()"
              [attr.aria-busy]="loggingOut()"
              (click)="logout()"
            >
              {{ loggingOut() ? 'Cerrando sesión…' : 'Cerrar sesión' }}
            </button>
          </div>
        </div>
      </header>
      <main>
        <router-outlet />
      </main>
    </div>
  `,
})
export class AppLayoutComponent {
  readonly authStore = inject(AuthStore);
  readonly tenantStore = inject(TenantStore);
  private readonly authLogout = inject(AuthLogoutService);
  readonly loggingOut = signal(false);

  logout(): void {
    if (this.loggingOut()) {
      return;
    }

    this.loggingOut.set(true);
    this.authLogout
      .logout()
      .pipe(finalize(() => this.loggingOut.set(false)))
      .subscribe();
  }
}
