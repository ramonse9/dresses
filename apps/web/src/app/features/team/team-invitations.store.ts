import { inject, Injectable, signal } from '@angular/core';
import { catchError, map, type Observable, of, Subject, switchMap, takeUntil, tap } from 'rxjs';
import { normalizeApiError } from '../../core/http/api-error';
import { TenantResetRegistry } from '../../core/tenant/tenant-reset-registry.service';
import { DEFAULT_INVITATION_LIMIT, DEFAULT_INVITATION_PAGE } from './team-invitation-filters';
import type {
  CreateTeamInvitationInput,
  PaginatedTeamInvitationsResponse,
  TeamInvitationFilters,
  TeamInvitationListState,
} from './team-invitation.models';
import { TeamInvitationsApiService } from './team-invitations-api.service';

const initialState: TeamInvitationListState = {
  status: 'idle',
  data: [],
  pagination: {
    page: DEFAULT_INVITATION_PAGE,
    limit: DEFAULT_INVITATION_LIMIT,
    total: 0,
    totalPages: 0,
  },
  filters: { page: DEFAULT_INVITATION_PAGE, limit: DEFAULT_INVITATION_LIMIT },
  error: null,
};

@Injectable({ providedIn: 'root' })
export class TeamInvitationsStore {
  private readonly api = inject(TeamInvitationsApiService);
  private readonly resetRegistry = inject(TenantResetRegistry);
  private readonly resetRequests = new Subject<void>();
  private readonly stateValue = signal(initialState);
  private requestId = 0;
  private tenantGeneration = 0;

  readonly state = this.stateValue.asReadonly();

  constructor() {
    this.resetRegistry.register(() => this.reset());
  }

  load(filters: TeamInvitationFilters): Observable<void> {
    const requestId = ++this.requestId;
    this.stateValue.set({
      status: 'loading',
      data: [],
      pagination: { page: filters.page, limit: filters.limit, total: 0, totalPages: 0 },
      filters,
      error: null,
    });
    return this.api.list(filters).pipe(
      takeUntil(this.resetRequests),
      tap((response) => {
        if (requestId === this.requestId) this.applyResponse(response, filters);
      }),
      map(() => undefined),
      catchError((error: unknown) => {
        if (requestId === this.requestId) {
          this.stateValue.set({
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

  create(input: CreateTeamInvitationInput): Observable<void> {
    return this.runMutation(this.api.create(input));
  }

  resend(id: string): Observable<void> {
    return this.runMutation(this.api.resend(id));
  }

  revoke(id: string): Observable<void> {
    return this.runMutation(this.api.revoke(id));
  }

  reset(): void {
    this.tenantGeneration += 1;
    this.requestId += 1;
    this.resetRequests.next();
    this.stateValue.set(initialState);
  }

  private runMutation(request: Observable<unknown>): Observable<void> {
    const generation = this.tenantGeneration;
    const filters = this.stateValue().filters;
    return request.pipe(
      switchMap(() => this.api.list(filters)),
      takeUntil(this.resetRequests),
      tap((response) => {
        if (generation === this.tenantGeneration) this.applyResponse(response, filters);
      }),
      map(() => undefined),
    );
  }

  private applyResponse(
    response: PaginatedTeamInvitationsResponse,
    filters: TeamInvitationFilters,
  ): void {
    this.stateValue.set({
      status: response.data.length === 0 ? 'empty' : 'loaded',
      data: response.data,
      pagination: response.pagination,
      filters,
      error: null,
    });
  }
}
