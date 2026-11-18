import { Component, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { AuthLogoutService } from '../../../core/auth/auth-logout.service';

@Component({
  selector: 'app-select-company-placeholder',
  standalone: true,
  template: `
    <main class="grid min-h-screen place-items-center bg-stone-950 px-6 text-stone-50">
      <section class="w-full max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8">
        <p class="text-sm font-semibold uppercase tracking-[0.2em] text-rose-200">Atelier</p>
        <h1 class="mt-3 font-serif text-4xl">Seleccionar empresa</h1>
        <p class="mt-4 text-base leading-7 text-stone-300">
          La selección segura de empresa se conectará posteriormente con el API.
        </p>
        <button
          type="button"
          class="mt-7 min-h-11 rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:ring-offset-2 focus:ring-offset-stone-950 disabled:cursor-not-allowed disabled:opacity-60"
          [disabled]="loggingOut()"
          [attr.aria-busy]="loggingOut()"
          (click)="logout()"
        >
          {{ loggingOut() ? 'Cerrando sesión…' : 'Cerrar sesión' }}
        </button>
      </section>
    </main>
  `,
})
export class SelectCompanyPlaceholderComponent {
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
