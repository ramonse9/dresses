import { DatePipe, Location } from '@angular/common';
import { Component, computed, inject, type OnDestroy, type OnInit, signal } from '@angular/core';
import {
  type AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  type ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { normalizeApiError } from '../../../core/http/api-error';
import { ErrorMessageComponent } from '../../../shared/ui/error-message/error-message.component';
import { LoadingIndicatorComponent } from '../../../shared/ui/loading-indicator/loading-indicator.component';
import { SubmitButtonComponent } from '../../../shared/ui/submit-button/submit-button.component';
import { InvitationAcceptanceApiService } from './invitation-acceptance-api.service';
import type {
  InvitationAcceptanceStatus,
  VerifiedInvitation,
} from './invitation-acceptance.models';

const invalidInvitationMessage = 'El enlace de invitación no es válido, expiró o ya fue utilizado.';

@Component({
  selector: 'app-invitation-acceptance-page',
  standalone: true,
  imports: [
    DatePipe,
    ErrorMessageComponent,
    LoadingIndicatorComponent,
    ReactiveFormsModule,
    RouterLink,
    SubmitButtonComponent,
  ],
  templateUrl: './invitation-acceptance-page.component.html',
})
export class InvitationAcceptancePageComponent implements OnInit, OnDestroy {
  private readonly api = inject(InvitationAcceptanceApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private token: string | null = null;

  readonly status = signal<InvitationAcceptanceStatus>('verifying');
  readonly invitation = signal<VerifiedInvitation | null>(null);
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly isNewAccount = computed(() => this.invitation()?.accountExists === false);
  readonly form = this.formBuilder.nonNullable.group({
    nombre: ['', Validators.maxLength(160)],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(1_024)]],
    passwordConfirmation: [''],
  });

  ngOnInit(): void {
    const fragment = this.route.snapshot.fragment;
    this.token = invitationTokenFromFragment(fragment);
    if (fragment !== null) {
      this.location.replaceState(this.router.url.split('#', 1)[0] || '/aceptar-invitacion');
    }
    if (!this.token) {
      this.invalidateInvitation();
      return;
    }

    this.api.verify(this.token).subscribe({
      next: (invitation) => {
        this.invitation.set(invitation);
        this.configureForm(invitation.accountExists);
        this.status.set('ready');
      },
      error: () => this.invalidateInvitation(),
    });
  }

  ngOnDestroy(): void {
    this.clearSensitiveState();
  }

  acceptInvitation(): void {
    if (this.status() !== 'ready' || !this.token || this.submitting()) return;
    this.form.controls.nombre.setValue(this.form.controls.nombre.value.trim(), {
      emitEvent: false,
    });
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const value = this.form.getRawValue();
    const token = this.token;
    const accountExists = this.invitation()?.accountExists === true;
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.api
      .accept({
        token,
        password: value.password,
        ...(accountExists ? {} : { nombre: value.nombre }),
      })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => {
          this.clearSensitiveState();
          this.status.set('accepted');
        },
        error: (error: unknown) => {
          const normalized = normalizeApiError(error);
          this.form.controls.password.reset('');
          this.form.controls.passwordConfirmation.reset('');
          if (normalized.status === 400 || normalized.status === 403) {
            this.invalidateInvitation();
            return;
          }
          this.errorMessage.set(
            normalized.status === 401
              ? 'La contraseña actual no es correcta.'
              : normalized.status === 429
                ? 'Demasiados intentos. Espera antes de volver a intentarlo.'
                : normalized.status === 409
                  ? 'Esta cuenta ya tiene acceso a la empresa.'
                  : 'No fue posible aceptar la invitación. Intenta nuevamente.',
          );
        },
      });
  }

  private configureForm(accountExists: boolean): void {
    if (accountExists) {
      this.form.controls.nombre.clearValidators();
      this.form.controls.passwordConfirmation.clearValidators();
      this.form.clearValidators();
    } else {
      this.form.controls.nombre.setValidators([Validators.required, Validators.maxLength(160)]);
      this.form.controls.passwordConfirmation.setValidators(Validators.required);
      this.form.setValidators(passwordConfirmationValidator);
    }
    this.form.controls.nombre.updateValueAndValidity({ emitEvent: false });
    this.form.controls.passwordConfirmation.updateValueAndValidity({ emitEvent: false });
    this.form.updateValueAndValidity({ emitEvent: false });
  }

  private invalidateInvitation(): void {
    this.token = null;
    this.invitation.set(null);
    this.errorMessage.set(invalidInvitationMessage);
    this.form.reset();
    this.status.set('invalid');
  }

  private clearSensitiveState(): void {
    this.token = null;
    this.invitation.set(null);
    this.errorMessage.set(null);
    this.form.reset();
  }
}

export function invitationTokenFromFragment(fragment: string | null): string | null {
  if (!fragment) return null;
  const token = new URLSearchParams(fragment).get('token');
  return token?.length ? token : null;
}

function passwordConfirmationValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmation = control.get('passwordConfirmation')?.value;
  return password === confirmation ? null : { passwordMismatch: true };
}
