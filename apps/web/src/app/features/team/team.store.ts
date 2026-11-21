import { inject, Injectable, signal } from '@angular/core';
import { catchError, map, type Observable, of, Subject, switchMap, takeUntil, tap } from 'rxjs';
import { normalizeApiError } from '../../core/http/api-error';
import type { EmpresaRole } from '../../core/tenant/tenant.models';
import { TenantResetRegistry } from '../../core/tenant/tenant-reset-registry.service';
import { DEFAULT_TEAM_LIMIT, DEFAULT_TEAM_PAGE } from './team-filters';
import type { TeamDetailState, TeamListFilters, TeamListState, TeamMember } from './team.models';
import { TeamApiService } from './team-api.service';

const defaultFilters: TeamListFilters = { page: DEFAULT_TEAM_PAGE, limit: DEFAULT_TEAM_LIMIT };
const initialListState: TeamListState = {
  status: 'idle',
  data: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  filters: defaultFilters,
  error: null,
};
const initialDetailState: TeamDetailState = { status: 'idle', data: null, error: null };

@Injectable({ providedIn: 'root' })
export class TeamStore {
  private readonly api = inject(TeamApiService);
  private readonly resetRegistry = inject(TenantResetRegistry);
  private readonly resetRequests = new Subject<void>();
  private readonly listStateValue = signal(initialListState);
  private readonly detailStateValue = signal(initialDetailState);
  private listRequestId = 0;
  private detailRequestId = 0;
  private tenantGeneration = 0;

  readonly listState = this.listStateValue.asReadonly();
  readonly detailState = this.detailStateValue.asReadonly();

  constructor() {
    this.resetRegistry.register(() => this.reset());
  }

  loadList(filters: TeamListFilters): Observable<void> {
    const requestId = ++this.listRequestId;
    this.listStateValue.set({
      status: 'loading',
      data: [],
      pagination: { page: filters.page, limit: filters.limit, total: 0, totalPages: 0 },
      filters,
      error: null,
    });
    return this.api.list(filters).pipe(
      takeUntil(this.resetRequests),
      tap((response) => {
        if (requestId === this.listRequestId) {
          this.listStateValue.set({
            status: response.data.length === 0 ? 'empty' : 'loaded',
            data: response.data,
            pagination: response.pagination,
            filters,
            error: null,
          });
        }
      }),
      map(() => undefined),
      catchError((error: unknown) => {
        if (requestId === this.listRequestId) {
          this.listStateValue.set({
            status: 'error',
            data: [],
            pagination: { page: filters.page, limit: filters.limit, total: 0, totalPages: 0 },
            filters,
            error: normalizeApiError(error),
          });
        }
        return of(undefined);
      }),
    );
  }

  loadDetail(id: string): Observable<void> {
    const requestId = ++this.detailRequestId;
    this.detailStateValue.set({ status: 'loading', data: null, error: null });
    return this.api.getById(id).pipe(
      takeUntil(this.resetRequests),
      tap((member) => {
        if (requestId === this.detailRequestId) {
          this.detailStateValue.set({ status: 'loaded', data: member, error: null });
        }
      }),
      map(() => undefined),
      catchError((error: unknown) => {
        if (requestId === this.detailRequestId) {
          this.detailStateValue.set({
            status: 'error',
            data: null,
            error: normalizeApiError(error),
          });
        }
        return of(undefined);
      }),
    );
  }

  changeRole(id: string, rol: EmpresaRole): Observable<TeamMember> {
    return this.runMutation(this.api.updateRole(id, rol), id);
  }

  changeStatus(id: string, activo: boolean): Observable<TeamMember> {
    return this.runMutation(this.api.updateStatus(id, activo), id);
  }

  reset(): void {
    this.tenantGeneration += 1;
    this.listRequestId += 1;
    this.detailRequestId += 1;
    this.resetRequests.next();
    this.listStateValue.set(initialListState);
    this.detailStateValue.set(initialDetailState);
  }

  private runMutation(request: Observable<TeamMember>, id: string): Observable<TeamMember> {
    const generation = this.tenantGeneration;
    return request.pipe(
      switchMap(() => this.api.getById(id)),
      takeUntil(this.resetRequests),
      tap((member) => {
        if (generation === this.tenantGeneration) {
          this.applyAuthoritativeMember(member);
        }
      }),
    );
  }

  private applyAuthoritativeMember(member: TeamMember): void {
    const listState = this.listStateValue();
    if (listState.status === 'loaded' && listState.data.some(({ id }) => id === member.id)) {
      this.listStateValue.set({
        ...listState,
        data: listState.data.map((current) => (current.id === member.id ? member : current)),
      });
    }
    if (this.detailStateValue().data?.id === member.id) {
      this.detailStateValue.set({ status: 'loaded', data: member, error: null });
    }
  }
}
