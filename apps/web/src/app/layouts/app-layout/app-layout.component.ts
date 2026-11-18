import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthLogoutService } from '../../core/auth/auth-logout.service';
import { AuthStore } from '../../core/auth/auth.store';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div class="min-h-screen bg-stone-100 text-stone-950">
      <header class="border-b border-stone-200 bg-white">
        <div class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4 lg:px-8">
          <div>
            <p class="font-serif text-xl">Atelier</p>
            @if (authStore.user(); as user) {
              <p class="text-sm text-stone-500">{{ user.email }}</p>
            }
          </div>
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
      </header>
      <main>
        <router-outlet />
      </main>
    </div>
  `,
})
export class AppLayoutComponent {
  readonly authStore = inject(AuthStore);
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
