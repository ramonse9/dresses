import { Component, computed, input } from '@angular/core';
import type { ApiError } from '../../../core/http/api-error';

@Component({
  selector: 'app-error-message',
  standalone: true,
  template: `
    @if (message()) {
      <div
        class="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        role="alert"
      >
        {{ message() }}
      </div>
    }
  `,
})
export class ErrorMessageComponent {
  readonly error = input<ApiError | string | null>(null);
  readonly message = computed(() => {
    const error = this.error();
    return typeof error === 'string' ? error : (error?.message ?? '');
  });
}
