import { Component, computed, DestroyRef, inject, type OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { debounceTime, distinctUntilChanged, map, switchMap, tap } from 'rxjs';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ErrorMessageComponent } from '../../shared/ui/error-message/error-message.component';
import { LoadingIndicatorComponent } from '../../shared/ui/loading-indicator/loading-indicator.component';
import { TenantStore } from '../../core/tenant/tenant.store';
import { teamErrorMessage } from './team-error-message';
import {
  MAXIMUM_TEAM_SEARCH_LENGTH,
  normalizeTeamSearch,
  teamFiltersFromParamMap,
  teamFiltersToQueryParams,
} from './team-filters';
import type { TeamListFilters } from './team.models';
import { TeamStore } from './team.store';

type RoleFilter = 'all' | 'OWNER' | 'EMPLOYEE';
type ActiveFilter = 'all' | 'true' | 'false';

@Component({
  selector: 'app-team-list-page',
  standalone: true,
  imports: [
    DatePipe,
    EmptyStateComponent,
    ErrorMessageComponent,
    LoadingIndicatorComponent,
    ReactiveFormsModule,
    RouterLink,
    RouterLinkActive,
  ],
  templateUrl: './team-list-page.component.html',
})
export class TeamListPageComponent implements OnInit {
  readonly store = inject(TeamStore);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tenantStore = inject(TenantStore);
  private readonly destroyRef = inject(DestroyRef);
  readonly maximumSearchLength = MAXIMUM_TEAM_SEARCH_LENGTH;
  readonly isOwner = computed(() => this.tenantStore.role() === 'OWNER');
  readonly pageSizes = [10, 20, 50, 100] as const;
  readonly filtersForm = this.formBuilder.nonNullable.group({
    q: '',
    rol: 'all' as RoleFilter,
    activo: 'all' as ActiveFilter,
    limit: 20,
  });
  readonly errorMessage = computed(() => teamErrorMessage(this.store.listState().error));
  readonly hasFilters = computed(() => {
    const filters = this.store.listState().filters;
    return filters.q !== undefined || filters.rol !== undefined || filters.activo !== undefined;
  });
  readonly returnQueryParams = computed(() =>
    teamFiltersToQueryParams(this.store.listState().filters),
  );

  ngOnInit(): void {
    this.filtersForm.controls.q.valueChanges
      .pipe(
        map(normalizeTeamSearch),
        debounceTime(350),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((q) => this.updateQuery({ q: q || null, page: 1 }));
    this.filtersForm.controls.rol.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((rol) => this.updateQuery({ rol: rol === 'all' ? null : rol, page: 1 }));
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
        map(teamFiltersFromParamMap),
        distinctUntilChanged(filtersEqual),
        tap((filters) => this.syncForm(filters)),
        switchMap((filters) => this.store.loadList(filters)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  goToPage(page: number): void {
    const pagination = this.store.listState().pagination;
    if (page < 1 || page > pagination.totalPages || page === pagination.page) return;
    this.updateQuery({ page });
  }

  clearFilters(): void {
    this.updateQuery({ q: null, rol: null, activo: null, page: 1 });
  }

  retry(): void {
    this.store.loadList(this.store.listState().filters).subscribe();
  }

  private syncForm(filters: TeamListFilters): void {
    this.filtersForm.setValue(
      {
        q: filters.q ?? '',
        rol: filters.rol ?? 'all',
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

function filtersEqual(first: TeamListFilters, second: TeamListFilters): boolean {
  return (
    first.page === second.page &&
    first.limit === second.limit &&
    first.rol === second.rol &&
    first.activo === second.activo &&
    first.q === second.q
  );
}
