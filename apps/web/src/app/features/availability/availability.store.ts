import { inject, Injectable, signal } from '@angular/core';
import { catchError, map, type Observable, of, Subject, takeUntil, tap } from 'rxjs';
import { normalizeApiError } from '../../core/http/api-error';
import { TenantResetRegistry } from '../../core/tenant/tenant-reset-registry.service';
import { DEFAULT_AVAILABILITY_LIMIT, DEFAULT_AVAILABILITY_PAGE } from './availability-filters';
import type { AvailabilityFilters, AvailabilityState } from './availability.models';
import { AvailabilityApiService } from './availability-api.service';

const initialState: AvailabilityState = {
  status: 'idle',
  data: [],
  pagination: {
    page: DEFAULT_AVAILABILITY_PAGE,
    limit: DEFAULT_AVAILABILITY_LIMIT,
    total: 0,
    totalPages: 0,
  },
  range: null,
  filters: null,
  error: null,
};

@Injectable({ providedIn: 'root' })
export class AvailabilityStore {
  private readonly api = inject(AvailabilityApiService);
  private readonly resetRegistry = inject(TenantResetRegistry);
  private readonly resetRequests = new Subject<void>();
  private readonly stateValue = signal(initialState);
  private requestId = 0;
  readonly state = this.stateValue.asReadonly();

  constructor() {
    this.resetRegistry.register(() => this.reset());
  }

  search(filters: AvailabilityFilters): Observable<void> {
    const requestId = ++this.requestId;
    this.stateValue.set({
      status: 'loading',
      data: [],
      range: null,
      filters,
      error: null,
      pagination: { page: filters.page, limit: filters.limit, total: 0, totalPages: 0 },
    });

    return this.api.find(filters).pipe(
      takeUntil(this.resetRequests),
      tap((response) => {
        if (requestId === this.requestId) {
          this.stateValue.set({
            status: response.data.length === 0 ? 'empty' : 'loaded',
            data: response.data,
            pagination: response.pagination,
            range: response.range,
            filters,
            error: null,
          });
        }
      }),
      map(() => undefined),
      catchError((error: unknown) => {
        if (requestId === this.requestId) {
          this.stateValue.set({
            status: 'error',
            data: [],
            range: null,
            filters,
            pagination: { page: filters.page, limit: filters.limit, total: 0, totalPages: 0 },
            error: normalizeApiError(error),
          });
        }
        return of(undefined);
      }),
    );
  }

  clear(): void {
    this.requestId += 1;
    this.resetRequests.next();
    this.stateValue.set(initialState);
  }

  reset(): void {
    this.clear();
  }
}
