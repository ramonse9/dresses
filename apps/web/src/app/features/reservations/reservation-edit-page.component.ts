import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, finalize, map } from 'rxjs';
import { hasAnyRole } from '../../core/auth/role-access';
import { normalizeApiError } from '../../core/http/api-error';
import { TenantStore } from '../../core/tenant/tenant.store';
import { ErrorMessageComponent } from '../../shared/ui/error-message/error-message.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator/loading-indicator.component';
import { SubmitButtonComponent } from '../../shared/ui/submit-button/submit-button.component';
import { browserTimeZoneLabel } from '../availability/availability-filters';
import { BranchesStore } from '../branches/branches.store';
import type { Customer } from '../customers/customer.models';
import { normalizeCustomerSearch } from '../customers/customer-filters';
import { formatDressMoney } from '../dresses/dress-money';
import type { Dress } from '../dresses/dress.models';
import { ReservationCreateStore } from './reservation-create.store';
import { reservationErrorMessage } from './reservation-error-message';
import {
  reservationFiltersFromParamMap,
  reservationFiltersToQueryParams,
  reservationIsoToLocalDateTime,
  reservationLocalDateTimeToIso,
} from './reservation-filters';
import type {
  ReservationCustomer,
  ReservationDressSnapshot,
  UpdateReservationInput,
} from './reservation.models';
import { ReservationsStore } from './reservations.store';

@Component({
  selector: 'app-reservation-edit-page',
  standalone: true,
  imports: [
    ErrorMessageComponent,
    LoadingIndicatorComponent,
    ReactiveFormsModule,
    RouterLink,
    SubmitButtonComponent,
  ],
  templateUrl: './reservation-edit-page.component.html',
})
export class ReservationEditPageComponent implements OnInit {
  readonly store = inject(ReservationsStore);
  readonly supportStore = inject(ReservationCreateStore);
  readonly branchesStore = inject(BranchesStore);
  private readonly tenantStore = inject(TenantStore);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private initializing = false;
  private submissionLocked = false;
  readonly reservationId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly canEditRole = computed(() => hasAnyRole(this.tenantStore.role(), ['OWNER', 'EMPLOYEE']));
  readonly isEditable = computed(() => {
    const status = this.store.detailState().data?.estado;
    return status === 'BORRADOR' || status === 'CONFIRMADA';
  });
  readonly loadError = computed(() =>
    reservationErrorMessage(this.store.detailState().error, true),
  );
  readonly availableBranches = computed(() => {
    const currentId = this.store.detailState().data?.sucursal.id;
    return this.branchesStore
      .listState()
      .data.filter(({ activo, id }) => activo || id === currentId);
  });
  readonly existingSnapshots = computed(() => this.store.detailState().data?.vestidos ?? []);
  readonly existingSnapshotIds = computed(
    () => new Set(this.existingSnapshots().map(({ id }) => id)),
  );
  readonly availableNewDresses = computed(() =>
    (this.supportStore.availability()?.data ?? []).filter(
      ({ id }) => !this.existingSnapshotIds().has(id),
    ),
  );
  readonly selectedDressIds = signal<readonly string[]>([]);
  readonly selectedCustomer = signal<ReservationCustomer | null>(null);
  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly selectionError = signal<string | null>(null);
  readonly timeZoneLabel = browserTimeZoneLabel();
  readonly formatMoney = formatDressMoney;
  readonly returnQueryParams = reservationFiltersToQueryParams(
    reservationFiltersFromParamMap(this.route.snapshot.queryParamMap),
  );
  readonly form = this.formBuilder.nonNullable.group({
    buscarCliente: '',
    clienteId: ['', Validators.required],
    sucursalId: ['', Validators.required],
    fechaInicio: ['', Validators.required],
    fechaFin: ['', Validators.required],
    notas: ['', Validators.maxLength(2000)],
  });

  ngOnInit(): void {
    if (!this.canEditRole()) return;
    if (['idle', 'error'].includes(this.branchesStore.listState().status)) {
      this.branchesStore.loadList().subscribe();
    }
    this.supportStore.searchCustomers().subscribe();
    this.store
      .loadDetail(this.reservationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.initializeFromDetail());

    this.form.controls.buscarCliente.valueChanges
      .pipe(
        map(normalizeCustomerSearch),
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((q) => this.supportStore.searchCustomers(q || undefined).subscribe());
    this.form.controls.sucursalId.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.initializing) return;
        this.selectedDressIds.set([]);
        this.refreshAvailability();
      });
  }

  selectCustomer(customer: Customer): void {
    this.selectedCustomer.set(customer);
    this.form.controls.clienteId.setValue(customer.id);
    this.formError.set(null);
  }

  refreshAfterDateChange(): void {
    this.refreshAvailability(true);
  }

  toggleSnapshot(snapshot: ReservationDressSnapshot): void {
    this.toggleId(snapshot.id);
  }

  toggleDress(dress: Dress): void {
    this.toggleId(dress.id);
  }

  isSelected(id: string): boolean {
    return this.selectedDressIds().includes(id);
  }

  submit(): void {
    if (!this.canEditRole() || !this.isEditable() || this.submitting() || this.submissionLocked) {
      return;
    }
    this.formError.set(null);
    const input = this.buildInput();
    if (!input) return;

    this.submissionLocked = true;
    this.submitting.set(true);
    this.store
      .update(this.reservationId, input)
      .pipe(
        finalize(() => {
          this.submissionLocked = false;
          this.submitting.set(false);
        }),
      )
      .subscribe({
        next: () =>
          void this.router.navigate(['/app/reservaciones', this.reservationId], {
            queryParams: this.returnQueryParams,
          }),
        error: (error: unknown) => {
          const normalized = normalizeApiError(error);
          if (normalized.status === 409) {
            this.formError.set(
              'La reservación cambió o alguna pieza ya no está disponible. Revisa el estado y la selección.',
            );
            this.store.loadDetail(this.reservationId).subscribe(() => {
              if (this.isEditable()) this.refreshAvailability(true);
            });
          } else if (normalized.status === 403) {
            this.formError.set('No tienes autorización para editar esta reservación.');
          } else if (normalized.status === 404) {
            this.formError.set('El cliente, la sucursal o alguna pieza ya no está disponible.');
          } else if (normalized.status === 400) {
            this.formError.set('Los cambios no son válidos. Revisa el formulario.');
          } else {
            this.formError.set('No fue posible actualizar la reservación. Intenta nuevamente.');
          }
        },
      });
  }

  private initializeFromDetail(): void {
    const reservation = this.store.detailState().data;
    if (!reservation) return;
    this.initializing = true;
    this.selectedCustomer.set(reservation.cliente);
    this.selectedDressIds.set(reservation.vestidos.map(({ id }) => id));
    this.form.patchValue(
      {
        clienteId: reservation.cliente.id,
        sucursalId: reservation.sucursal.id,
        fechaInicio: reservationIsoToLocalDateTime(reservation.fechaInicio),
        fechaFin: reservationIsoToLocalDateTime(reservation.fechaFin),
        notas: reservation.notas ?? '',
      },
      { emitEvent: false },
    );
    this.initializing = false;
    if (this.isEditable()) this.refreshAvailability(true);
  }

  private toggleId(id: string): void {
    const ids = this.selectedDressIds();
    if (ids.includes(id)) {
      this.selectedDressIds.set(ids.filter((currentId) => currentId !== id));
      this.selectionError.set(null);
      return;
    }
    if (ids.length >= 50) {
      this.selectionError.set('Puedes seleccionar como máximo 50 vestidos.');
      return;
    }
    this.selectedDressIds.set([...ids, id]);
    this.selectionError.set(null);
  }

  private refreshAvailability(preserveSelection = false): void {
    this.selectionError.set(null);
    const sucursalId = this.form.controls.sucursalId.value;
    const fechaInicio = reservationLocalDateTimeToIso(this.form.controls.fechaInicio.value);
    const fechaFin = reservationLocalDateTimeToIso(this.form.controls.fechaFin.value);
    if (!sucursalId || !fechaInicio || !fechaFin) {
      this.supportStore.clearAvailability();
      return;
    }
    if (new Date(fechaFin).getTime() <= new Date(fechaInicio).getTime()) {
      this.supportStore.clearAvailability();
      this.formError.set('La fecha final debe ser posterior a la fecha inicial.');
      return;
    }
    const previousIds = preserveSelection ? this.selectedDressIds() : [];
    this.supportStore
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
          if (!preserveSelection) return;
          const currentBranchId = this.store.detailState().data?.sucursal.id;
          const retainedSnapshots =
            sucursalId === currentBranchId ? this.existingSnapshotIds() : new Set<string>();
          const availableIds = new Set(response.data.map(({ id }) => id));
          this.selectedDressIds.set(
            previousIds.filter((id) => retainedSnapshots.has(id) || availableIds.has(id)),
          );
        },
        error: () => undefined,
      });
  }

  private buildInput(): UpdateReservationInput | null {
    this.form.markAllAsTouched();
    const value = this.form.getRawValue();
    const fechaInicio = reservationLocalDateTimeToIso(value.fechaInicio);
    const fechaFin = reservationLocalDateTimeToIso(value.fechaFin);
    const vestidoIds = [...new Set(this.selectedDressIds())];
    if (!value.clienteId || !value.sucursalId || !fechaInicio || !fechaFin) {
      this.formError.set('Selecciona cliente, sucursal y un rango válido.');
      return null;
    }
    if (new Date(fechaFin).getTime() <= new Date(fechaInicio).getTime()) {
      this.formError.set('La fecha final debe ser posterior a la fecha inicial.');
      return null;
    }
    if (vestidoIds.length < 1 || vestidoIds.length > 50) {
      this.formError.set('Selecciona entre 1 y 50 vestidos.');
      return null;
    }
    return {
      clienteId: value.clienteId,
      sucursalId: value.sucursalId,
      vestidoIds,
      fechaInicio,
      fechaFin,
      notas: value.notas.trim() || null,
    };
  }
}
