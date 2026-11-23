import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ErrorMessageComponent } from '../../../shared/ui/error-message/error-message.component';
import { SubmitButtonComponent } from '../../../shared/ui/submit-button/submit-button.component';
import { PasswordRecoveryApiService } from './password-recovery-api.service';

const requestFailureMessage = 'No fue posible procesar la solicitud. Intenta nuevamente más tarde.';

@Component({
  selector: 'app-request-password-page',
  standalone: true,
  imports: [ErrorMessageComponent, ReactiveFormsModule, RouterLink, SubmitButtonComponent],
  templateUrl: './request-password-page.component.html',
})
export class RequestPasswordPageComponent {
  private readonly api = inject(PasswordRecoveryApiService);
  private readonly formBuilder = inject(FormBuilder);

  readonly submitting = signal(false);
  readonly responseMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
  });

  onSubmit(): void {
    if (this.submitting()) return;

    this.form.controls.email.setValue(this.form.controls.email.value.trim().toLowerCase(), {
      emitEvent: false,
    });
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.responseMessage.set(null);
    this.api
      .request({ email: this.form.controls.email.value })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: ({ message }) => {
          this.form.reset();
          this.responseMessage.set(message);
        },
        error: (error: unknown) => {
          this.errorMessage.set(
            error instanceof HttpErrorResponse && error.status === 429
              ? retryAfterMessage(error)
              : requestFailureMessage,
          );
        },
      });
  }
}

export function retryAfterMessage(error: HttpErrorResponse): string {
  const rawSeconds = error.headers.get('Retry-After');
  const seconds = rawSeconds === null ? Number.NaN : Number(rawSeconds);
  return Number.isInteger(seconds) && seconds > 0
    ? `Demasiadas solicitudes. Intenta nuevamente en ${seconds} segundos.`
    : 'Demasiadas solicitudes. Intenta nuevamente más tarde.';
}
