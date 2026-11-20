import { Component, computed, DestroyRef, inject, type OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, map, switchMap, tap } from 'rxjs';
import { BranchesStore } from '../branches/branches.store';
import { TenantStore } from '../../core/tenant/tenant.store';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ErrorMessageComponent } from '../../shared/ui/error-message/error-message.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator/loading-indicator.component';
import { dressErrorMessage } from './dress-error-message';
import {
  dressFiltersFromParamMap,
  dressFiltersToQueryParams,
  MAXIMUM_DRESS_SEARCH_LENGTH,
  normalizeDressSearch,
} from './dress-filters';
import { formatDressMoney } from './dress-money';
import type { DressListFilters, DressOperationalState } from './dress.models';
import { DressesStore } from './dresses.store';

type ActiveFilter = 'all' | 'true' | 'false';
type OperationalFilter = 'all' | DressOperationalState;

@Component({
  selector: 'app-dresses-list-page',
  standalone: true,
  imports: [
    EmptyStateComponent,
    ErrorMessageComponent,
    LoadingIndicatorComponent,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './dresses-list-page.component.html',
})
export class DressesListPageComponent implements OnInit {
  readonly store = inject(DressesStore);
  readonly branchesStore = inject(BranchesStore);
  private readonly tenantStore = inject(TenantStore);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly maximumSearchLength = MAXIMUM_DRESS_SEARCH_LENGTH;
  readonly pageSizes = [10, 20, 50, 100] as const;
  readonly formatMoney = formatDressMoney;
  readonly filtersForm = this.formBuilder.nonNullable.group({
    q: '',
    sucursalId: 'all',
    activo: 'all' as ActiveFilter,
    estadoOperativo: 'all' as OperationalFilter,
    limit: 20,
  });
  readonly errorMessage = computed(() => dressErrorMessage(this.store.listState().error));
  readonly isOwner = computed(() => this.tenantStore.role() === 'OWNER');
  readonly hasFilters = computed(() => {
    const filters = this.store.listState().filters;
    return (
      filters.q !== undefined ||
      filters.sucursalId !== undefined ||
      filters.activo !== undefined ||
      filters.estadoOperativo !== undefined
    );
  });
  readonly returnQueryParams = computed(() =>
    dressFiltersToQueryParams(this.store.listState().filters),
  );

  ngOnInit(): void {
    if (['idle', 'error'].includes(this.branchesStore.listState().status)) {
      this.branchesStore.loadList().subscribe();
    }

    this.filtersForm.controls.q.valueChanges
      .pipe(
        map(normalizeDressSearch),
        debounceTime(350),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((q) => this.updateQuery({ q: q || null, page: 1 }));

    this.filtersForm.controls.sucursalId.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((sucursalId) =>
        this.updateQuery({ sucursalId: sucursalId === 'all' ? null : sucursalId, page: 1 }),
      );

    this.filtersForm.controls.activo.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((activo) =>
        this.updateQuery({ activo: activo === 'all' ? null : activo, page: 1 }),
      );

    this.filtersForm.controls.estadoOperativo.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((estadoOperativo) =>
        this.updateQuery({
          estadoOperativo: estadoOperativo === 'all' ? null : estadoOperativo,
          page: 1,
        }),
      );

    this.filtersForm.controls.limit.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((limit) => this.updateQuery({ limit, page: 1 }));

    this.route.queryParamMap
      .pipe(
        map(dressFiltersFromParamMap),
        distinctUntilChanged(filtersEqual),
        tap((filters) => this.syncForm(filters)),
        switchMap((filters) => this.store.loadList(filters)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  goToPage(page: number): void {
    const pagination = this.store.listState().pagination;
    if (page < 1 || page > pagination.totalPages || page === pagination.page) {
      return;
    }
    this.updateQuery({ page });
  }

  clearFilters(): void {
    this.updateQuery({
      q: null,
      sucursalId: null,
      activo: null,
      estadoOperativo: null,
      page: 1,
    });
  }

  retry(): void {
    this.store.loadList(this.store.listState().filters).subscribe();
  }

  private syncForm(filters: DressListFilters): void {
    this.filtersForm.setValue(
      {
        q: filters.q ?? '',
        sucursalId: filters.sucursalId ?? 'all',
        activo: filters.activo === undefined ? 'all' : filters.activo ? 'true' : 'false',
        estadoOperativo: filters.estadoOperativo ?? 'all',
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

function filtersEqual(first: DressListFilters, second: DressListFilters): boolean {
  return (
    first.page === second.page &&
    first.limit === second.limit &&
    first.sucursalId === second.sucursalId &&
    first.activo === second.activo &&
    first.estadoOperativo === second.estadoOperativo &&
    first.q === second.q
  );
}
