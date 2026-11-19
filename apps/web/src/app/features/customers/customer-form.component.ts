import { Component, effect, inject, input, output } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ErrorMessageComponent } from '../../shared/ui/error-message/error-message.component';
import { SubmitButtonComponent } from '../../shared/ui/submit-button/submit-button.component';
import type { CreateCustomerInput, Customer } from './customer.models';

const contactRequiredValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const telefono = String(control.get('telefono')?.value ?? '').trim();
  const email = String(control.get('email')?.value ?? '').trim();
  return telefono || email ? null : { contactRequired: true };
};

@Component({
  selector: 'app-customer-form',
  standalone: true,
  imports: [ErrorMessageComponent, ReactiveFormsModule, SubmitButtonComponent],
  templateUrl: './customer-form.component.html',
})
export class CustomerFormComponent {
  private readonly formBuilder = inject(FormBuilder);
  private submissionLocked = false;
  readonly initialValue = input<Customer | null>(null);
  readonly submitting = input(false);
  readonly submitLabel = input('Guardar cliente');
  readonly submittingLabel = input('Guardando…');
  readonly serverError = input<string | null>(null);
  readonly submitted = output<CreateCustomerInput>();
  readonly form = this.formBuilder.nonNullable.group(
    {
      nombre: ['', [Validators.required, Validators.maxLength(160)]],
      telefono: ['', Validators.maxLength(40)],
      email: ['', [Validators.email, Validators.maxLength(254)]],
      direccion: ['', Validators.maxLength(255)],
      notas: ['', Validators.maxLength(2_000)],
    },
    { validators: contactRequiredValidator },
  );

  constructor() {
    effect(() => {
      const customer = this.initialValue();
      if (customer) {
        this.form.setValue({
          nombre: customer.nombre,
          telefono: customer.telefono ?? '',
          email: customer.email ?? '',
          direccion: customer.direccion ?? '',
          notas: customer.notas ?? '',
        });
      }
    });
    effect(() => {
      if (!this.submitting()) {
        this.submissionLocked = false;
      }
    });
  }

  onSubmit(): void {
    if (this.submitting() || this.submissionLocked) {
      return;
    }

    const value = this.form.getRawValue();
    this.form.setValue({
      nombre: value.nombre.trim(),
      telefono: value.telefono.trim(),
      email: value.email.trim().toLowerCase(),
      direccion: value.direccion.trim(),
      notas: value.notas.trim(),
    });

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const normalized = this.form.getRawValue();
    this.submissionLocked = true;
    this.submitted.emit({
      nombre: normalized.nombre,
      telefono: normalized.telefono || null,
      email: normalized.email || null,
      direccion: normalized.direccion || null,
      notas: normalized.notas || null,
    });
  }
}
