import { inject, Injectable, signal } from '@angular/core';
import { catchError, map, type Observable, of, Subject, takeUntil, tap } from 'rxjs';
import { normalizeApiError } from '../../core/http/api-error';
import { TenantResetRegistry } from '../../core/tenant/tenant-reset-registry.service';
import { DEFAULT_RESERVATION_LIMIT, DEFAULT_RESERVATION_PAGE } from './reservation-filters';
import type {
  CancelReservationInput,
  ReservationDetailState,
  ReservationFilters,
  ReservationListState,
  UpdateReservationInput,
} from './reservation.models';
import { ReservationsApiService } from './reservations-api.service';

const initialListState: ReservationListState = {
  status: 'idle',
  data: [],
  pagination: {
    page: DEFAULT_RESERVATION_PAGE,
    limit: DEFAULT_RESERVATION_LIMIT,
    total: 0,
    totalPages: 0,
  },
  filters: { page: DEFAULT_RESERVATION_PAGE, limit: DEFAULT_RESERVATION_LIMIT },
  error: null,
};
const initialDetailState: ReservationDetailState = { status: 'idle', data: null, error: null };

@Injectable({ providedIn: 'root' })
export class ReservationsStore {
  private readonly api = inject(ReservationsApiService);
  private readonly resetRegistry = inject(TenantResetRegistry);
  private readonly resetRequests = new Subject<void>();
  private readonly listStateValue = signal(initialListState);
  private readonly detailStateValue = signal(initialDetailState);
  private listRequestId = 0;
  private detailRequestId = 0;
  readonly listState = this.listStateValue.asReadonly();
  readonly detailState = this.detailStateValue.asReadonly();

  constructor() {
    this.resetRegistry.register(() => this.reset());
  }

  loadList(filters: ReservationFilters): Observable<void> {
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
            status: response.data.length ? 'loaded' : 'empty',
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
      tap((reservation) => {
        if (requestId === this.detailRequestId)
          this.detailStateValue.set({ status: 'loaded', data: reservation, error: null });
      }),
      map(() => undefined),
      catchError((error: unknown) => {
        if (requestId === this.detailRequestId)
          this.detailStateValue.set({
            status: 'error',
            data: null,
            error: normalizeApiError(error),
          });
        return of(undefined);
      }),
    );
  }

  update(id: string, input: UpdateReservationInput) {
    return this.api.update(id, input).pipe(takeUntil(this.resetRequests));
  }

  confirm(id: string) {
    return this.api.confirm(id).pipe(takeUntil(this.resetRequests));
  }

  deliver(id: string) {
    return this.api.deliver(id).pipe(takeUntil(this.resetRequests));
  }

  returnReservation(id: string) {
    return this.api.returnReservation(id).pipe(takeUntil(this.resetRequests));
  }

  cancel(id: string, input: CancelReservationInput) {
    return this.api.cancel(id, input).pipe(takeUntil(this.resetRequests));
  }

  reset(): void {
    this.listRequestId += 1;
    this.detailRequestId += 1;
    this.resetRequests.next();
    this.listStateValue.set(initialListState);
    this.detailStateValue.set(initialDetailState);
  }
}
