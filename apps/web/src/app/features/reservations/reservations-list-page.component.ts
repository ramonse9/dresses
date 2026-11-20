import { Component, computed, DestroyRef, inject, type OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, map, switchMap, tap } from 'rxjs';
import { BranchesStore } from '../branches/branches.store';
import { CustomersStore } from '../customers/customers.store';
import { formatDressMoney } from '../dresses/dress-money';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ErrorMessageComponent } from '../../shared/ui/error-message/error-message.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator/loading-indicator.component';
import { formatReservationDate, reservationStatusLabel } from './reservation-display';
import { reservationErrorMessage } from './reservation-error-message';
import {
  MAXIMUM_RESERVATION_SEARCH_LENGTH,
  normalizeReservationSearch,
  reservationFiltersFromParamMap,
  reservationFiltersToQueryParams,
  reservationIsoToLocalDateTime,
  reservationLocalDateTimeToIso,
} from './reservation-filters';
import type { ReservationFilters, ReservationStatus } from './reservation.models';
import { ReservationsStore } from './reservations.store';

type StatusFilter = 'all' | ReservationStatus;

@Component({
  selector: 'app-reservations-list-page',
  standalone: true,
  imports: [
    EmptyStateComponent,
    ErrorMessageComponent,
    LoadingIndicatorComponent,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './reservations-list-page.component.html',
})
export class ReservationsListPageComponent implements OnInit {
  readonly store = inject(ReservationsStore);
  readonly branchesStore = inject(BranchesStore);
  readonly customersStore = inject(CustomersStore);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly pageSizes = [10, 20, 50, 100] as const;
  readonly maximumSearchLength = MAXIMUM_RESERVATION_SEARCH_LENGTH;
  readonly formatDate = formatReservationDate;
  readonly formatMoney = formatDressMoney;
  readonly statusLabel = reservationStatusLabel;
  readonly dateError = signal<string | null>(null);
  readonly filtersForm = this.formBuilder.nonNullable.group({
    q: '',
    clienteId: 'all',
    sucursalId: 'all',
    estado: 'all' as StatusFilter,
    fechaDesde: '',
    fechaHasta: '',
    limit: 20,
  });
  readonly errorMessage = computed(() => reservationErrorMessage(this.store.listState().error));
  readonly hasFilters = computed(() => {
    const filters = this.store.listState().filters;
    return !!(
      filters.q ||
      filters.clienteId ||
      filters.sucursalId ||
      filters.estado ||
      filters.fechaDesde ||
      filters.fechaHasta
    );
  });
  readonly returnQueryParams = computed(() =>
    reservationFiltersToQueryParams(this.store.listState().filters),
  );

  ngOnInit(): void {
    if (['idle', 'error'].includes(this.branchesStore.listState().status)) {
      this.branchesStore.loadList().subscribe();
    }
    this.customersStore.loadList({ page: 1, limit: 100 }).subscribe();

    this.filtersForm.controls.q.valueChanges
      .pipe(
        map(normalizeReservationSearch),
        debounceTime(350),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((q) => this.updateQuery({ q: q || null, page: 1 }));

    this.filtersForm.controls.clienteId.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((clienteId) =>
        this.updateQuery({ clienteId: clienteId === 'all' ? null : clienteId, page: 1 }),
      );
    this.filtersForm.controls.sucursalId.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((sucursalId) =>
        this.updateQuery({ sucursalId: sucursalId === 'all' ? null : sucursalId, page: 1 }),
      );
    this.filtersForm.controls.estado.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((estado) =>
        this.updateQuery({ estado: estado === 'all' ? null : estado, page: 1 }),
      );
    this.filtersForm.controls.limit.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((limit) => this.updateQuery({ limit, page: 1 }));

    this.route.queryParamMap
      .pipe(
        map(reservationFiltersFromParamMap),
        distinctUntilChanged(filtersEqual),
        tap((filters) => this.syncForm(filters)),
        switchMap((filters) => this.store.loadList(filters)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  applyDateRange(): void {
    this.dateError.set(null);
    const rawStart = this.filtersForm.controls.fechaDesde.value;
    const rawEnd = this.filtersForm.controls.fechaHasta.value;
    const fechaDesde = reservationLocalDateTimeToIso(rawStart);
    const fechaHasta = reservationLocalDateTimeToIso(rawEnd);
    if ((rawStart && !fechaDesde) || (rawEnd && !fechaHasta)) {
      this.dateError.set('Ingresa fechas y horas locales válidas.');
      return;
    }
    if (
      fechaDesde &&
      fechaHasta &&
      new Date(fechaHasta).getTime() <= new Date(fechaDesde).getTime()
    ) {
      this.dateError.set('La fecha final debe ser posterior a la fecha inicial.');
      return;
    }
    this.updateQuery({ fechaDesde, fechaHasta, page: 1 });
  }

  goToPage(page: number): void {
    const pagination = this.store.listState().pagination;
    if (page < 1 || page > pagination.totalPages || page === pagination.page) return;
    this.updateQuery({ page });
  }

  clearFilters(): void {
    this.dateError.set(null);
    this.updateQuery({
      q: null,
      clienteId: null,
      sucursalId: null,
      estado: null,
      fechaDesde: null,
      fechaHasta: null,
      page: 1,
    });
  }

  retry(): void {
    this.store.loadList(this.store.listState().filters).subscribe();
  }

  private syncForm(filters: ReservationFilters): void {
    this.dateError.set(null);
    this.filtersForm.setValue(
      {
        q: filters.q ?? '',
        clienteId: filters.clienteId ?? 'all',
        sucursalId: filters.sucursalId ?? 'all',
        estado: filters.estado ?? 'all',
        fechaDesde: reservationIsoToLocalDateTime(filters.fechaDesde),
        fechaHasta: reservationIsoToLocalDateTime(filters.fechaHasta),
        limit: filters.limit,
      },
      { emitEvent: false },
    );
  }

  private updateQuery(queryParams: Record<string, string | number | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}

function filtersEqual(first: ReservationFilters, second: ReservationFilters): boolean {
  return (
    first.page === second.page &&
    first.limit === second.limit &&
    first.clienteId === second.clienteId &&
    first.sucursalId === second.sucursalId &&
    first.estado === second.estado &&
    first.fechaDesde === second.fechaDesde &&
    first.fechaHasta === second.fechaHasta &&
    first.q === second.q
  );
}
