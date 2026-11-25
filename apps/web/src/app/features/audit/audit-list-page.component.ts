import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, type OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { distinctUntilChanged, map, switchMap, tap } from 'rxjs';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ErrorMessageComponent } from '../../shared/ui/error-message/error-message.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator/loading-indicator.component';
import { auditErrorMessage } from './audit-error-message';
import {
  AUDIT_UUID_PATTERN,
  auditFiltersFromParamMap,
  auditFiltersToQueryParams,
  auditIsoToLocalDateTime,
  auditLocalDateTimeToIso,
} from './audit-filters';
import { auditActionLabel, auditResourceLabel, auditSummary } from './audit-metadata';
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
  type AuditAction,
  type AuditListFilters,
  type AuditResourceType,
} from './audit.models';
import { AuditStore } from './audit.store';

type ActionFilter = AuditAction | 'all';
type ResourceFilter = AuditResourceType | 'all';

@Component({
  selector: 'app-audit-list-page',
  standalone: true,
  imports: [
    DatePipe,
    EmptyStateComponent,
    ErrorMessageComponent,
    LoadingIndicatorComponent,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './audit-list-page.component.html',
})
export class AuditListPageComponent implements OnInit {
  readonly store = inject(AuditStore);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly actions = AUDIT_ACTIONS;
  readonly resourceTypes = AUDIT_RESOURCE_TYPES;
  readonly actionLabel = auditActionLabel;
  readonly resourceLabel = auditResourceLabel;
  readonly summary = auditSummary;
  readonly pageSizes = [10, 20, 50, 100] as const;
  readonly filterError = signal<string | null>(null);
  readonly filtersForm = this.formBuilder.nonNullable.group({
    action: 'all' as ActionFilter,
    resourceType: 'all' as ResourceFilter,
    resourceId: ['', [Validators.pattern(AUDIT_UUID_PATTERN)]],
    actor: ['', [Validators.pattern(AUDIT_UUID_PATTERN)]],
    fechaDesde: '',
    fechaHasta: '',
    limit: 20,
  });
  readonly errorMessage = computed(() => auditErrorMessage(this.store.listState().error));
  readonly hasFilters = computed(() => {
    const filters = this.store.listState().filters;
    return Boolean(
      filters.action ||
      filters.resourceType ||
      filters.resourceId ||
      filters.actor ||
      filters.fechaDesde ||
      filters.fechaHasta,
    );
  });
  readonly returnQueryParams = computed(() =>
    auditFiltersToQueryParams(this.store.listState().filters),
  );

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(
        map(auditFiltersFromParamMap),
        distinctUntilChanged(filtersEqual),
        tap((filters) => this.syncForm(filters)),
        switchMap((filters) => this.store.loadList(filters)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  applyFilters(): void {
    this.filterError.set(null);
    if (this.filtersForm.invalid) {
      this.filtersForm.markAllAsTouched();
      this.filterError.set('Los identificadores deben ser UUID válidos.');
      return;
    }

    const values = this.filtersForm.getRawValue();
    const fechaDesde = auditLocalDateTimeToIso(values.fechaDesde);
    const fechaHasta = auditLocalDateTimeToIso(values.fechaHasta);
    if (fechaDesde === null || fechaHasta === null) {
      this.filterError.set('Revisa las fechas del rango.');
      return;
    }
    if (fechaDesde && fechaHasta && Date.parse(fechaHasta) <= Date.parse(fechaDesde)) {
      this.filterError.set('La fecha final debe ser posterior a la fecha inicial.');
      return;
    }

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        action: values.action === 'all' ? null : values.action,
        resourceType: values.resourceType === 'all' ? null : values.resourceType,
        resourceId: values.resourceId.trim().toLowerCase() || null,
        actor: values.actor.trim().toLowerCase() || null,
        fechaDesde: fechaDesde || null,
        fechaHasta: fechaHasta || null,
        limit: values.limit,
        page: 1,
      },
      queryParamsHandling: 'merge',
    });
  }

  clearFilters(): void {
    this.filterError.set(null);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        action: null,
        resourceType: null,
        resourceId: null,
        actor: null,
        fechaDesde: null,
        fechaHasta: null,
        page: 1,
      },
      queryParamsHandling: 'merge',
    });
  }

  goToPage(page: number): void {
    const pagination = this.store.listState().pagination;
    if (page < 1 || page > pagination.totalPages || page === pagination.page) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page },
      queryParamsHandling: 'merge',
    });
  }

  retry(): void {
    this.store.loadList(this.store.listState().filters).subscribe();
  }

  private syncForm(filters: AuditListFilters): void {
    this.filtersForm.setValue(
      {
        action: filters.action ?? 'all',
        resourceType: filters.resourceType ?? 'all',
        resourceId: filters.resourceId ?? '',
        actor: filters.actor ?? '',
        fechaDesde: auditIsoToLocalDateTime(filters.fechaDesde),
        fechaHasta: auditIsoToLocalDateTime(filters.fechaHasta),
        limit: filters.limit,
      },
      { emitEvent: false },
    );
  }
}

function filtersEqual(first: AuditListFilters, second: AuditListFilters): boolean {
  return (
    first.page === second.page &&
    first.limit === second.limit &&
    first.action === second.action &&
    first.resourceType === second.resourceType &&
    first.resourceId === second.resourceId &&
    first.actor === second.actor &&
    first.fechaDesde === second.fechaDesde &&
    first.fechaHasta === second.fechaHasta
  );
}
