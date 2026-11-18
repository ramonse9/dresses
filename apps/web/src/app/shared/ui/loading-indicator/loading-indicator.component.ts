import { Component, input } from '@angular/core';

@Component({
  selector: 'app-loading-indicator',
  standalone: true,
  template: `
    <div class="flex items-center gap-3 text-sm text-stone-600" role="status" aria-live="polite">
      <span
        class="size-5 animate-spin rounded-full border-2 border-stone-300 border-t-rose-600"
        aria-hidden="true"
      ></span>
      <span>{{ label() }}</span>
    </div>
  `,
})
export class LoadingIndicatorComponent {
  readonly label = input('Cargando…');
}
