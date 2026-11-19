import { Component, effect, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { Branch, CreateBranchInput } from './branch.models';
import { ErrorMessageComponent } from '../../shared/ui/error-message/error-message.component';
import { SubmitButtonComponent } from '../../shared/ui/submit-button/submit-button.component';

@Component({
  selector: 'app-branch-form',
  standalone: true,
  imports: [ErrorMessageComponent, ReactiveFormsModule, SubmitButtonComponent],
  templateUrl: './branch-form.component.html',
})
export class BranchFormComponent {
  private readonly formBuilder = inject(FormBuilder);
  private submissionLocked = false;
  readonly initialValue = input<Branch | null>(null);
  readonly submitting = input(false);
  readonly submitLabel = input('Guardar sucursal');
  readonly submittingLabel = input('Guardando…');
  readonly serverError = input<string | null>(null);
  readonly submitted = output<CreateBranchInput>();
  readonly form = this.formBuilder.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(160)]],
    direccion: ['', Validators.maxLength(255)],
    telefono: ['', Validators.maxLength(40)],
  });

  constructor() {
    effect(() => {
      const branch = this.initialValue();
      if (branch) {
        this.form.setValue({
          nombre: branch.nombre,
          direccion: branch.direccion ?? '',
          telefono: branch.telefono ?? '',
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
      direccion: value.direccion.trim(),
      telefono: value.telefono.trim(),
    });

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const normalized = this.form.getRawValue();
    this.submissionLocked = true;
    this.submitted.emit({
      nombre: normalized.nombre,
      direccion: normalized.direccion || null,
      telefono: normalized.telefono || null,
    });
  }
}
