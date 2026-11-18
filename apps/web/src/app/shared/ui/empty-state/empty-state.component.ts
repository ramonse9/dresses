import { Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  template: `
    <section class="rounded-3xl border border-dashed border-stone-300 bg-white p-8 text-center">
      <h2 class="font-serif text-2xl text-stone-900">{{ title() }}</h2>
      @if (description()) {
        <p class="mx-auto mt-3 max-w-xl text-base leading-7 text-stone-600">
          {{ description() }}
        </p>
      }
    </section>
  `,
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly description = input('');
}
