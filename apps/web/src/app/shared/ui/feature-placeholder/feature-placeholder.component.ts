import { Component, input } from '@angular/core';

@Component({
  selector: 'app-feature-placeholder',
  standalone: true,
  template: `
    <section class="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <div class="rounded-3xl border border-stone-200 bg-white p-7 shadow-sm sm:p-10">
        <p class="text-sm font-semibold uppercase tracking-[0.18em] text-rose-700">
          {{ eyebrow() }}
        </p>
        <h1 class="mt-3 font-serif text-3xl text-stone-950 sm:text-4xl">{{ title() }}</h1>
        <p class="mt-4 max-w-2xl text-base leading-7 text-stone-600">{{ description() }}</p>
        <div
          class="mt-8 rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-5 py-8 text-center text-base text-stone-500"
        >
          Este módulo se conectará con sus datos en un siguiente paso.
        </div>
      </div>
    </section>
  `,
})
export class FeaturePlaceholderComponent {
  readonly eyebrow = input('Área privada');
  readonly title = input.required<string>();
  readonly description = input.required<string>();
}
