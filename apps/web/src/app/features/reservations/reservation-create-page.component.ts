import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, finalize, map } from 'rxjs';
import { normalizeApiError } from '../../core/http/api-error';
import { BranchesStore } from '../branches/branches.store';
import type { Customer } from '../customers/customer.models';
import { formatDressMoney } from '../dresses/dress-money';
import type { Dress } from '../dresses/dress.models';
import { ErrorMessageComponent } from '../../shared/ui/error-message/error-message.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator/loading-indicator.component';
import { SubmitButtonComponent } from '../../shared/ui/submit-button/submit-button.component';
import { browserTimeZoneLabel } from '../availability/availability-filters';
import { normalizeCustomerSearch } from '../customers/customer-filters';
import { sumReservationMoney } from './reservation-estimate';
import { reservationLocalDateTimeToIso } from './reservation-filters';
import type { CreateReservationInput } from './reservation.models';
import { ReservationCreateStore } from './reservation-create.store';

@Component({
  selector: 'app-reservation-create-page',
  standalone: true,
  imports: [
    ErrorMessageComponent,
    LoadingIndicatorComponent,
    ReactiveFormsModule,
    RouterLink,
    SubmitButtonComponent,
  ],
  templateUrl: './reservation-create-page.component.html',
})
export class ReservationCreatePageComponent implements OnInit {
  readonly store = inject(ReservationCreateStore);
  readonly branchesStore = inject(BranchesStore);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private submissionLocked = false;
  readonly formatMoney = formatDressMoney;
  readonly timeZoneLabel = browserTimeZoneLabel();
  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly conflictMessage = signal<string | null>(null);
  readonly selectionError = signal<string | null>(null);
  readonly selectedCustomer = signal<Customer | null>(null);
  readonly selectedDressIds = signal<readonly string[]>([]);
  readonly activeBranches = computed(() =>
    this.branchesStore.listState().data.filter(({ activo }) => activo),
  );
  readonly selectedDresses = computed(() => {
    const selected = new Set(this.selectedDressIds());
    return (this.store.availability()?.data ?? []).filter(({ id }) => selected.has(id));
  });
  readonly estimatedRent = computed(() =>
    sumReservationMoney(this.selectedDresses().map(({ precioRenta }) => precioRenta)),
  );
  readonly estimatedDeposit = computed(() =>
    sumReservationMoney(this.selectedDresses().map(({ deposito }) => deposito ?? '0.00')),
  );
  selectedBranchName(): string {
    const id = this.form.controls.sucursalId.value;
    return this.activeBranches().find((branch) => branch.id === id)?.nombre ?? 'Sin seleccionar';
  }
  readonly form = this.formBuilder.nonNullable.group({
    buscarCliente: '',
    clienteId: ['', Validators.required],
    sucursalId: ['', Validators.required],
    fechaInicio: ['', Validators.required],
    fechaFin: ['', Validators.required],
    notas: ['', Validators.maxLength(2000)],
    confirmar: true,
  });

  ngOnInit(): void {
    if (['idle', 'error'].includes(this.branchesStore.listState().status)) {
      this.branchesStore.loadList().subscribe();
    }
    this.store.searchCustomers().subscribe();
    this.form.controls.buscarCliente.valueChanges
      .pipe(
        map(normalizeCustomerSearch),
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((q) => this.store.searchCustomers(q || undefined).subscribe());
    this.form.controls.sucursalId.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.selectedDressIds.set([]);
        this.conflictMessage.set(null);
        this.refreshAvailability();
      });
  }

  selectCustomer(customer: Customer): void {
    this.selectedCustomer.set(customer);
    this.form.controls.clienteId.setValue(customer.id);
    this.formError.set(null);
  }

  refreshAfterDateChange(): void {
    this.selectedDressIds.set([]);
    this.conflictMessage.set(null);
    this.refreshAvailability();
  }

  toggleDress(dress: Dress): void {
    const ids = this.selectedDressIds();
    if (ids.includes(dress.id)) {
      this.selectedDressIds.set(ids.filter((id) => id !== dress.id));
      this.selectionError.set(null);
      return;
    }
    if (ids.length >= 50) {
      this.selectionError.set('Puedes seleccionar como máximo 50 vestidos.');
      return;
    }
    this.selectedDressIds.set([...ids, dress.id]);
    this.selectionError.set(null);
  }

  isSelected(id: string): boolean {
    return this.selectedDressIds().includes(id);
  }

  submit(): void {
    if (this.submitting() || this.submissionLocked) return;
    this.formError.set(null);
    this.conflictMessage.set(null);
    const payload = this.buildPayload();
    if (!payload) return;

    this.submissionLocked = true;
    this.submitting.set(true);
    this.store
      .create(payload)
      .pipe(
        finalize(() => {
          this.submitting.set(false);
          this.submissionLocked = false;
        }),
      )
      .subscribe({
        next: (reservation) => void this.router.navigate(['/app/reservaciones', reservation.id]),
        error: (error: unknown) => {
          const normalized = normalizeApiError(error);
          if (normalized.status === 409) {
            this.conflictMessage.set(
              'Una o más piezas dejaron de estar disponibles. Revisamos nuevamente el rango; confirma tu selección antes de reintentar.',
            );
            this.refreshAvailability(true);
          } else if (normalized.status === 403) {
            this.formError.set('Perdiste autorización para crear reservaciones en esta empresa.');
          } else if (normalized.status === 404) {
            this.formError.set('El cliente, la sucursal o alguna pieza ya no está disponible.');
          } else if (normalized.status === 400) {
            this.formError.set('Los datos de la reservación no son válidos. Revisa el formulario.');
          } else {
            this.formError.set('No fue posible crear la reservación. Intenta nuevamente.');
          }
        },
      });
  }

  private buildPayload(): CreateReservationInput | null {
    this.form.markAllAsTouched();
    const value = this.form.getRawValue();
    const fechaInicio = reservationLocalDateTimeToIso(value.fechaInicio);
    const fechaFin = reservationLocalDateTimeToIso(value.fechaFin);
    const ids = [...new Set(this.selectedDressIds())];
    if (!value.clienteId || !value.sucursalId || !fechaInicio || !fechaFin) {
      this.formError.set('Selecciona cliente, sucursal y un rango válido.');
      return null;
    }
    if (new Date(fechaFin).getTime() <= new Date(fechaInicio).getTime()) {
      this.formError.set('La fecha final debe ser posterior a la fecha inicial.');
      return null;
    }
    if (ids.length < 1 || ids.length > 50) {
      this.formError.set('Selecciona entre 1 y 50 vestidos disponibles.');
      return null;
    }
    return {
      clienteId: value.clienteId,
      sucursalId: value.sucursalId,
      vestidoIds: ids,
      fechaInicio,
      fechaFin,
      notas: value.notas.trim() || null,
      confirmar: value.confirmar,
    };
  }

  private refreshAvailability(preserveValidSelection = false): void {
    this.formError.set(null);
    this.selectionError.set(null);
    const sucursalId = this.form.controls.sucursalId.value;
    const fechaInicio = reservationLocalDateTimeToIso(this.form.controls.fechaInicio.value);
    const fechaFin = reservationLocalDateTimeToIso(this.form.controls.fechaFin.value);
    if (!sucursalId || !fechaInicio || !fechaFin) {
      this.store.clearAvailability();
      return;
    }
    if (new Date(fechaFin).getTime() <= new Date(fechaInicio).getTime()) {
      this.store.clearAvailability();
      this.formError.set('La fecha final debe ser posterior a la fecha inicial.');
      return;
    }
    const previousIds = preserveValidSelection ? this.selectedDressIds() : [];
    this.store
      .loadAvailability({
        sucursalId,
        fechaInicio,
        fechaFin,
        estadoOperativo: 'DISPONIBLE',
        page: 1,
        limit: 100,
      })
      .subscribe({
        next: (response) => {
          if (preserveValidSelection) {
            const available = new Set(response.data.map(({ id }) => id));
            this.selectedDressIds.set(previousIds.filter((id) => available.has(id)));
          }
        },
        error: () => undefined,
      });
  }
}
