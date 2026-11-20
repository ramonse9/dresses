import { Component, computed, DestroyRef, inject, type OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';
import { BranchesStore } from '../branches/branches.store';
import { formatDressMoney } from '../dresses/dress-money';
import type { DressOperationalState } from '../dresses/dress.models';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ErrorMessageComponent } from '../../shared/ui/error-message/error-message.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator/loading-indicator.component';
import { SubmitButtonComponent } from '../../shared/ui/submit-button/submit-button.component';
import { availabilityErrorMessage } from './availability-error-message';
import {
  availabilityFiltersFromParamMap,
  availabilityFiltersToQueryParams,
  browserTimeZoneLabel,
  isoToLocalDateTime,
  localDateTimeToIso,
  MAXIMUM_COLOR_LENGTH,
  MAXIMUM_SIZE_LENGTH,
} from './availability-filters';
import type { AvailabilityFilters } from './availability.models';
import { AvailabilityStore } from './availability.store';

@Component({
  selector: 'app-availability-page',
  standalone: true,
  imports: [
    EmptyStateComponent,
    ErrorMessageComponent,
    LoadingIndicatorComponent,
    ReactiveFormsModule,
    RouterLink,
    SubmitButtonComponent,
  ],
  templateUrl: './availability-page.component.html',
})
export class AvailabilityPageComponent implements OnInit {
  readonly store = inject(AvailabilityStore);
  readonly branchesStore = inject(BranchesStore);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly pageSizes = [10, 20, 50, 100] as const;
  readonly maximumSizeLength = MAXIMUM_SIZE_LENGTH;
  readonly maximumColorLength = MAXIMUM_COLOR_LENGTH;
  readonly formatMoney = formatDressMoney;
  readonly localValidationError = signal<string | null>(null);
  readonly timeZoneLabel = signal(browserTimeZoneLabel());
  readonly activeBranches = computed(() =>
    this.branchesStore.listState().data.filter(({ activo }) => activo),
  );
  readonly errorMessage = computed(() => availabilityErrorMessage(this.store.state().error));
  readonly form = this.formBuilder.nonNullable.group({
    sucursalId: ['', Validators.required],
    fechaInicio: ['', Validators.required],
    fechaFin: ['', Validators.required],
    talla: ['', Validators.maxLength(MAXIMUM_SIZE_LENGTH)],
    color: ['', Validators.maxLength(MAXIMUM_COLOR_LENGTH)],
    estadoOperativo: ['DISPONIBLE' as DressOperationalState, Validators.required],
    limit: 20,
  });

  ngOnInit(): void {
    if (['idle', 'error'].includes(this.branchesStore.listState().status)) {
      this.branchesStore.loadList().subscribe();
    }

    this.route.queryParamMap
      .pipe(
        map(availabilityFiltersFromParamMap),
        distinctUntilChanged(filtersEqual),
        tap((filters) => {
          this.localValidationError.set(null);
          if (filters) this.syncForm(filters);
        }),
        switchMap((filters) => {
          if (!filters) {
            this.store.clear();
            return of(undefined);
          }
          return this.store.search(filters);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  submit(): void {
    this.localValidationError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.localValidationError.set('Completa la sucursal y ambas fechas para consultar.');
      return;
    }

    const value = this.form.getRawValue();
    const fechaInicio = localDateTimeToIso(value.fechaInicio);
    const fechaFin = localDateTimeToIso(value.fechaFin);
    if (!fechaInicio || !fechaFin) {
      this.localValidationError.set('Ingresa fechas y horas locales válidas.');
      return;
    }
    if (new Date(fechaFin).getTime() <= new Date(fechaInicio).getTime()) {
      this.localValidationError.set('La fecha final debe ser posterior a la fecha inicial.');
      return;
    }

    const talla = normalizeText(value.talla);
    const color = normalizeText(value.color);
    const filters: AvailabilityFilters = {
      sucursalId: value.sucursalId,
      fechaInicio,
      fechaFin,
      estadoOperativo: value.estadoOperativo,
      page: 1,
      limit: value.limit,
      ...(talla ? { talla } : {}),
      ...(color ? { color } : {}),
    };
    void this.navigate(filters);
  }

  goToPage(page: number): void {
    const state = this.store.state();
    if (
      !state.filters ||
      page < 1 ||
      page > state.pagination.totalPages ||
      page === state.pagination.page
    ) {
      return;
    }
    void this.navigate({ ...state.filters, page });
  }

  retry(): void {
    const filters = this.store.state().filters;
    if (filters) this.store.search(filters).subscribe();
  }

  formatRangeDate(value: string): string {
    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  private syncForm(filters: AvailabilityFilters): void {
    this.form.setValue(
      {
        sucursalId: filters.sucursalId,
        fechaInicio: isoToLocalDateTime(filters.fechaInicio),
        fechaFin: isoToLocalDateTime(filters.fechaFin),
        talla: filters.talla ?? '',
        color: filters.color ?? '',
        estadoOperativo: filters.estadoOperativo,
        limit: filters.limit,
      },
      { emitEvent: false },
    );
    this.timeZoneLabel.set(browserTimeZoneLabel(new Date(filters.fechaInicio)));
  }

  private navigate(filters: AvailabilityFilters): Promise<boolean> {
    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams: availabilityFiltersToQueryParams(filters),
    });
  }
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function filtersEqual(
  first: AvailabilityFilters | null,
  second: AvailabilityFilters | null,
): boolean {
  if (first === null || second === null) return first === second;
  return (
    first.sucursalId === second.sucursalId &&
    first.fechaInicio === second.fechaInicio &&
    first.fechaFin === second.fechaFin &&
    first.talla === second.talla &&
    first.color === second.color &&
    first.estadoOperativo === second.estadoOperativo &&
    first.page === second.page &&
    first.limit === second.limit
  );
}
