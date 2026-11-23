import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, type OnDestroy, type OnInit, signal } from '@angular/core';
import {
  type AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  type ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ErrorMessageComponent } from '../../../shared/ui/error-message/error-message.component';
import { SubmitButtonComponent } from '../../../shared/ui/submit-button/submit-button.component';
import { PasswordRecoveryApiService } from './password-recovery-api.service';

const invalidTokenMessage = 'El enlace de recuperación no es válido o ya no está disponible.';

@Component({
  selector: 'app-reset-password-page',
  standalone: true,
  imports: [ErrorMessageComponent, ReactiveFormsModule, RouterLink, SubmitButtonComponent],
  templateUrl: './reset-password-page.component.html',
})
export class ResetPasswordPageComponent implements OnInit, OnDestroy {
  private readonly api = inject(PasswordRecoveryApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private token: string | null = null;

  readonly submitting = signal(false);
  readonly invalidToken = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly form = this.formBuilder.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(1_024)]],
      passwordConfirmation: ['', Validators.required],
    },
    { validators: passwordConfirmationValidator },
  );

  ngOnInit(): void {
    const fragment = this.route.snapshot.fragment;
    this.token = passwordResetTokenFromFragment(fragment);
    if (fragment !== null) {
      this.location.replaceState(this.router.url.split('#', 1)[0] || '/restablecer-password');
    }
    if (!this.token) this.invalidateToken();
  }

  ngOnDestroy(): void {
    this.clearSensitiveState();
  }

  onSubmit(): void {
    if (!this.token || this.invalidToken() || this.submitting()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const token = this.token;
    const password = this.form.controls.password.value;
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.api
      .reset({ token, password })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => {
          this.clearSensitiveState();
          void this.router.navigate(['/login'], {
            queryParams: { passwordRestablecida: 'true' },
            replaceUrl: true,
          });
        },
        error: (error: unknown) => {
          this.form.reset();
          if (error instanceof HttpErrorResponse && error.status === 400) {
            this.invalidateToken();
            return;
          }
          this.errorMessage.set(
            error instanceof HttpErrorResponse && error.status === 409
              ? 'La nueva contraseña debe ser diferente de la contraseña actual.'
              : error instanceof HttpErrorResponse && error.status === 429
                ? 'Demasiados intentos. Espera antes de volver a intentarlo.'
                : 'No fue posible restablecer la contraseña. Intenta nuevamente.',
          );
        },
      });
  }

  private invalidateToken(): void {
    this.token = null;
    this.form.reset();
    this.invalidToken.set(true);
    this.errorMessage.set(invalidTokenMessage);
  }

  private clearSensitiveState(): void {
    this.token = null;
    this.form.reset();
    this.errorMessage.set(null);
  }
}

export function passwordResetTokenFromFragment(fragment: string | null): string | null {
  if (!fragment) return null;
  const token = new URLSearchParams(fragment).get('token');
  return token?.length ? token : null;
}

function passwordConfirmationValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmation = control.get('passwordConfirmation')?.value;
  return password === confirmation ? null : { passwordMismatch: true };
}
