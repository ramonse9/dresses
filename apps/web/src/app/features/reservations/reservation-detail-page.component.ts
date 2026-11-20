import { Component, computed, DestroyRef, inject, type OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { distinctUntilChanged, finalize, map, switchMap } from 'rxjs';
import { normalizeApiError } from '../../core/http/api-error';
import { TenantStore } from '../../core/tenant/tenant.store';
import { formatDressMoney } from '../dresses/dress-money';
import { ErrorMessageComponent } from '../../shared/ui/error-message/error-message.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator/loading-indicator.component';
import { formatReservationDate, reservationStatusLabel } from './reservation-display';
import { reservationErrorMessage } from './reservation-error-message';
import {
  reservationFiltersFromParamMap,
  reservationFiltersToQueryParams,
} from './reservation-filters';
import {
  availableReservationTransitions,
  reservationTransitionDescription,
  reservationTransitionLabel,
} from './reservation-lifecycle';
import type { ReservationTransition } from './reservation.models';
import { ReservationsStore } from './reservations.store';

@Component({
  selector: 'app-reservation-detail-page',
  standalone: true,
  imports: [ErrorMessageComponent, LoadingIndicatorComponent, ReactiveFormsModule, RouterLink],
  templateUrl: './reservation-detail-page.component.html',
})
export class ReservationDetailPageComponent implements OnInit {
  readonly store = inject(ReservationsStore);
  private readonly tenantStore = inject(TenantStore);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly formatDate = formatReservationDate;
  readonly formatMoney = formatDressMoney;
  readonly statusLabel = reservationStatusLabel;
  readonly transitionLabel = reservationTransitionLabel;
  readonly transitionDescription = reservationTransitionDescription;
  readonly errorMessage = computed(() =>
    reservationErrorMessage(this.store.detailState().error, true),
  );
  readonly returnQueryParams = reservationFiltersToQueryParams(
    reservationFiltersFromParamMap(this.route.snapshot.queryParamMap),
  );
  readonly pendingTransition = signal<ReservationTransition | null>(null);
  readonly transitionSubmitting = signal(false);
  readonly transitionError = signal<string | null>(null);
  readonly cancelReason = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(1000)],
  });
  readonly availableTransitions = computed(() => {
    const reservation = this.store.detailState().data;
    return reservation
      ? availableReservationTransitions(reservation.estado, this.tenantStore.role())
      : [];
  });
  readonly isEditable = computed(() => {
    const status = this.store.detailState().data?.estado;
    return status === 'BORRADOR' || status === 'CONFIRMADA';
  });

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((params) => params.get('id') ?? ''),
        distinctUntilChanged(),
        switchMap((id) => this.store.loadDetail(id)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  retry(): void {
    this.store.loadDetail(this.route.snapshot.paramMap.get('id') ?? '').subscribe();
  }

  requestTransition(transition: ReservationTransition): void {
    if (this.transitionSubmitting() || !this.availableTransitions().includes(transition)) {
      return;
    }
    this.transitionError.set(null);
    this.cancelReason.setValue('');
    this.pendingTransition.set(transition);
  }

  closeTransitionDialog(): void {
    if (!this.transitionSubmitting()) this.pendingTransition.set(null);
  }

  confirmTransition(): void {
    const transition = this.pendingTransition();
    const reservation = this.store.detailState().data;
    if (
      !transition ||
      !reservation ||
      this.transitionSubmitting() ||
      !this.availableTransitions().includes(transition)
    ) {
      return;
    }
    if (transition === 'cancelar' && this.cancelReason.invalid) {
      this.cancelReason.markAsTouched();
      return;
    }

    const request =
      transition === 'confirmar'
        ? this.store.confirm(reservation.id)
        : transition === 'entregar'
          ? this.store.deliver(reservation.id)
          : transition === 'devolver'
            ? this.store.returnReservation(reservation.id)
            : this.store.cancel(reservation.id, {
                motivo: this.cancelReason.value.trim() || null,
              });

    this.transitionSubmitting.set(true);
    this.transitionError.set(null);
    request.pipe(finalize(() => this.transitionSubmitting.set(false))).subscribe({
      next: () => {
        this.pendingTransition.set(null);
        this.store.loadDetail(reservation.id).subscribe();
      },
      error: (error: unknown) => {
        const normalized = normalizeApiError(error);
        this.pendingTransition.set(null);
        if (normalized.status === 409) {
          this.transitionError.set(
            'La reservación cambió mientras realizabas esta acción. Mostramos el estado actualizado.',
          );
          this.store.loadDetail(reservation.id).subscribe();
        } else if (normalized.status === 403) {
          this.transitionError.set('No tienes autorización para realizar esta transición.');
        } else if (normalized.status === 404) {
          this.transitionError.set('La reservación ya no está disponible en esta empresa.');
        } else {
          this.transitionError.set('No fue posible actualizar el estado. Intenta nuevamente.');
        }
      },
    });
  }
}
