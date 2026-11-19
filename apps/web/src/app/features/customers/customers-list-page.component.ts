import { Component, computed, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, map, switchMap, tap } from 'rxjs';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ErrorMessageComponent } from '../../shared/ui/error-message/error-message.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator/loading-indicator.component';
import { customerErrorMessage } from './customer-error-message';
import {
  customerFiltersFromParamMap,
  customerFiltersToQueryParams,
  MAXIMUM_CUSTOMER_SEARCH_LENGTH,
  normalizeCustomerSearch,
} from './customer-filters';
import type { CustomerListFilters } from './customer.models';
import { CustomersStore } from './customers.store';

type ActiveFilter = 'all' | 'true' | 'false';

@Component({
  selector: 'app-customers-list-page',
  standalone: true,
  imports: [
    EmptyStateComponent,
    ErrorMessageComponent,
    LoadingIndicatorComponent,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './customers-list-page.component.html',
})
export class CustomersListPageComponent implements OnInit {
  readonly store = inject(CustomersStore);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly maximumSearchLength = MAXIMUM_CUSTOMER_SEARCH_LENGTH;
  readonly pageSizes = [10, 20, 50, 100] as const;
  readonly filtersForm = this.formBuilder.nonNullable.group({
    q: '',
    activo: 'all' as ActiveFilter,
    limit: 20,
  });
  readonly errorMessage = computed(() => customerErrorMessage(this.store.listState().error));
  readonly hasFilters = computed(() => {
    const filters = this.store.listState().filters;
    return filters.q !== undefined || filters.activo !== undefined;
  });
  readonly returnQueryParams = computed(() =>
    customerFiltersToQueryParams(this.store.listState().filters),
  );

  ngOnInit(): void {
    this.filtersForm.controls.q.valueChanges
      .pipe(
        map(normalizeCustomerSearch),
        debounceTime(350),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((q) => this.updateQuery({ q: q || null, page: 1 }));

    this.filtersForm.controls.activo.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((activo) =>
        this.updateQuery({ activo: activo === 'all' ? null : activo, page: 1 }),
      );

    this.filtersForm.controls.limit.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((limit) => this.updateQuery({ limit, page: 1 }));

    this.route.queryParamMap
      .pipe(
        map(customerFiltersFromParamMap),
        distinctUntilChanged(filtersEqual),
        tap((filters) => this.syncForm(filters)),
        switchMap((filters) => this.store.loadList(filters)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  goToPage(page: number): void {
    const totalPages = this.store.listState().pagination.totalPages;
    if (page < 1 || page > totalPages || page === this.store.listState().pagination.page) {
      return;
    }
    this.updateQuery({ page });
  }

  clearFilters(): void {
    this.updateQuery({ q: null, activo: null, page: 1 });
  }

  retry(): void {
    this.store.loadList(this.store.listState().filters).subscribe();
  }

  private syncForm(filters: CustomerListFilters): void {
    this.filtersForm.setValue(
      {
        q: filters.q ?? '',
        activo: filters.activo === undefined ? 'all' : filters.activo ? 'true' : 'false',
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

function filtersEqual(first: CustomerListFilters, second: CustomerListFilters): boolean {
  return (
    first.page === second.page &&
    first.limit === second.limit &&
    first.activo === second.activo &&
    first.q === second.q
  );
}
