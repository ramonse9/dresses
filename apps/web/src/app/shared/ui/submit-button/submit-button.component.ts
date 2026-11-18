import { Component, input } from '@angular/core';

@Component({
  selector: 'app-submit-button',
  standalone: true,
  template: `
    <button
      type="submit"
      class="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-rose-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-rose-800 focus:outline-none focus:ring-2 focus:ring-rose-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      [disabled]="disabled() || loading()"
      [attr.aria-busy]="loading()"
    >
      @if (loading()) {
        <span
          class="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
          aria-hidden="true"
        ></span>
        {{ loadingLabel() }}
      } @else {
        {{ label() }}
      }
    </button>
  `,
})
export class SubmitButtonComponent {
  readonly label = input('Guardar');
  readonly loadingLabel = input('Guardando…');
  readonly loading = input(false);
  readonly disabled = input(false);
}
