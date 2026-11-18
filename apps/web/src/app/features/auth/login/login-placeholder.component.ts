import { Component } from '@angular/core';

@Component({
  selector: 'app-login-placeholder',
  standalone: true,
  template: `
    <main class="grid min-h-screen place-items-center bg-stone-950 px-6 text-stone-50">
      <section class="w-full max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8">
        <p class="text-sm font-semibold uppercase tracking-[0.2em] text-rose-200">Atelier</p>
        <h1 class="mt-3 font-serif text-4xl">Acceso</h1>
        <p class="mt-4 text-base leading-7 text-stone-300">
          El flujo de autenticación se implementará en el siguiente paso.
        </p>
      </section>
    </main>
  `,
})
export class LoginPlaceholderComponent {}
