import { Component, effect, inject, input, output } from '@angular/core';
import {
  type AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  type ValidationErrors,
  Validators,
} from '@angular/forms';
import type { Branch } from '../branches/branch.models';
import { ErrorMessageComponent } from '../../shared/ui/error-message/error-message.component';
import { SubmitButtonComponent } from '../../shared/ui/submit-button/submit-button.component';
import type { Dress, DressFormValue, DressOperationalState } from './dress.models';

const MONEY_PATTERN = /^(0|[1-9]\d{0,9})(?:\.(\d{1,2}))?$/;

@Component({
  selector: 'app-dress-form',
  standalone: true,
  imports: [ErrorMessageComponent, ReactiveFormsModule, SubmitButtonComponent],
  templateUrl: './dress-form.component.html',
})
export class DressFormComponent {
  private readonly formBuilder = inject(FormBuilder);
  private submissionLocked = false;
  readonly initialValue = input<Dress | null>(null);
  readonly branches = input<readonly Branch[]>([]);
  readonly showActive = input(false);
  readonly submitting = input(false);
  readonly submitLabel = input('Guardar vestido');
  readonly submittingLabel = input('Guardando…');
  readonly serverError = input<string | null>(null);
  readonly submitted = output<DressFormValue>();
  readonly form = this.formBuilder.nonNullable.group({
    sucursalId: ['', Validators.required],
    codigo: ['', [Validators.required, Validators.maxLength(50)]],
    nombre: ['', [Validators.required, Validators.maxLength(160)]],
    descripcion: ['', Validators.maxLength(1000)],
    talla: ['', [Validators.required, Validators.maxLength(30)]],
    color: ['', [Validators.required, Validators.maxLength(80)]],
    marca: ['', Validators.maxLength(100)],
    precioRenta: ['', [Validators.required, decimalMoneyValidator]],
    deposito: ['', decimalMoneyValidator],
    estadoOperativo: ['DISPONIBLE' as DressOperationalState, Validators.required],
    activo: true,
  });

  constructor() {
    effect(() => {
      const dress = this.initialValue();
      if (dress) {
        this.form.setValue({
          sucursalId: dress.sucursalId,
          codigo: dress.codigo,
          nombre: dress.nombre,
          descripcion: dress.descripcion ?? '',
          talla: dress.talla,
          color: dress.color,
          marca: dress.marca ?? '',
          precioRenta: dress.precioRenta,
          deposito: dress.deposito ?? '',
          estadoOperativo: dress.estadoOperativo,
          activo: dress.activo,
        });
      }
    });
    effect(() => {
      if (!this.submitting()) this.submissionLocked = false;
    });
  }

  normalizeCode(): void {
    const control = this.form.controls.codigo;
    const normalized = control.value.toUpperCase();
    if (normalized !== control.value) control.setValue(normalized, { emitEvent: false });
  }

  onSubmit(): void {
    if (this.submitting() || this.submissionLocked) return;
    const raw = this.form.getRawValue();
    this.form.patchValue({
      codigo: raw.codigo.trim().toUpperCase(),
      nombre: raw.nombre.trim(),
      descripcion: raw.descripcion.trim(),
      talla: raw.talla.trim(),
      color: raw.color.trim(),
      marca: raw.marca.trim(),
      precioRenta: raw.precioRenta.trim(),
      deposito: raw.deposito.trim(),
    });
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.submissionLocked = true;
    this.submitted.emit({
      ...value,
      descripcion: value.descripcion || null,
      marca: value.marca || null,
      precioRenta: normalizeMoney(value.precioRenta)!,
      deposito: value.deposito ? normalizeMoney(value.deposito) : null,
    });
  }

  hasCurrentInactiveBranch(): boolean {
    const dress = this.initialValue();
    return !!dress && !this.branches().some(({ id }) => id === dress.sucursalId);
  }
}

export function decimalMoneyValidator(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value.trim();
  return value === '' || MONEY_PATTERN.test(value) ? null : { decimalMoney: true };
}

export function normalizeMoney(value: string): string | null {
  const match = MONEY_PATTERN.exec(value.trim());
  return match ? `${match[1]}.${(match[2] ?? '').padEnd(2, '0')}` : null;
}
