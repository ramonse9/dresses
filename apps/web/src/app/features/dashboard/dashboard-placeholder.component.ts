import { Component } from '@angular/core';

@Component({
  selector: 'app-dashboard-placeholder',
  standalone: true,
  template: `
    <section class="mx-auto max-w-6xl px-6 py-16">
      <p class="text-sm font-semibold uppercase tracking-[0.2em] text-rose-700">Área privada</p>
      <h1 class="mt-3 font-serif text-4xl">Panel de operación</h1>
      <p class="mt-4 max-w-2xl text-base leading-7 text-stone-600">
        Este espacio queda preparado para los futuros módulos autenticados.
      </p>
    </section>
  `,
})
export class DashboardPlaceholderComponent {}
