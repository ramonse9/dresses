import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { sanitizeReturnUrl } from '../../../core/auth/return-url';
import { SubmitButtonComponent } from '../../../shared/ui/submit-button/submit-button.component';

const invalidCredentialsMessage = 'Correo o contraseña incorrectos.';
const loginFailureMessage = 'No fue posible iniciar sesión. Intenta nuevamente.';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, SubmitButtonComponent],
  templateUrl: './login-page.component.html',
})
export class LoginPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authStore = inject(AuthStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage =
    this.route.snapshot.queryParamMap.get('passwordRestablecida') === 'true'
      ? 'Tu contraseña fue actualizada. Cerramos las sesiones anteriores; inicia sesión nuevamente.'
      : null;
  readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  onSubmit(): void {
    if (this.submitting()) {
      return;
    }

    this.form.controls.email.setValue(this.form.controls.email.value.trim().toLowerCase());

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    const value = this.form.getRawValue();

    this.authStore
      .login({
        email: value.email,
        password: value.password,
      })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => {
          const returnUrl = sanitizeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
          void this.router.navigateByUrl(returnUrl ?? '/seleccionar-empresa');
        },
        error: (error: unknown) => {
          this.errorMessage.set(
            error instanceof HttpErrorResponse && error.status === 401
              ? invalidCredentialsMessage
              : loginFailureMessage,
          );
        },
      });
  }
}
