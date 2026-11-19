import { inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, Subject, takeUntil, tap } from 'rxjs';
import { normalizeApiError } from '../../core/http/api-error';
import { TenantResetRegistry } from '../../core/tenant/tenant-reset-registry.service';
import { DEFAULT_CUSTOMER_LIMIT, DEFAULT_CUSTOMER_PAGE } from './customer-filters';
import type {
  CreateCustomerInput,
  Customer,
  CustomerDetailState,
  CustomerListFilters,
  CustomerListState,
  UpdateCustomerInput,
} from './customer.models';
import { CustomersApiService } from './customers-api.service';

const defaultFilters: CustomerListFilters = {
  page: DEFAULT_CUSTOMER_PAGE,
  limit: DEFAULT_CUSTOMER_LIMIT,
};

const initialListState: CustomerListState = {
  status: 'idle',
  data: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  filters: defaultFilters,
  error: null,
};

const initialDetailState: CustomerDetailState = {
  status: 'idle',
  data: null,
  error: null,
};

@Injectable({ providedIn: 'root' })
export class CustomersStore {
  private readonly api = inject(CustomersApiService);
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

  loadList(filters: CustomerListFilters): Observable<void> {
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
      tap((customer) => {
        if (requestId === this.detailRequestId) {
          this.detailStateValue.set({ status: 'loaded', data: customer, error: null });
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

  create(input: CreateCustomerInput): Observable<Customer> {
    return this.runMutation(this.api.create(input));
  }

  update(id: string, input: UpdateCustomerInput): Observable<Customer> {
    return this.runMutation(this.api.update(id, input));
  }

  deactivate(id: string): Observable<Customer> {
    return this.runMutation(this.api.deactivate(id));
  }

  reactivate(id: string): Observable<Customer> {
    return this.runMutation(this.api.updateStatus(id, true));
  }

  reset(): void {
    this.tenantGeneration += 1;
    this.listRequestId += 1;
    this.detailRequestId += 1;
    this.resetRequests.next();
    this.listStateValue.set(initialListState);
    this.detailStateValue.set(initialDetailState);
  }

  private runMutation(request: Observable<Customer>): Observable<Customer> {
    const generation = this.tenantGeneration;
    return request.pipe(
      takeUntil(this.resetRequests),
      tap((customer) => {
        if (generation === this.tenantGeneration) {
          this.applyMutation(customer);
        }
      }),
    );
  }

  private applyMutation(customer: Customer): void {
    const listState = this.listStateValue();
    const exists = listState.data.some(({ id }) => id === customer.id);
    if ((listState.status === 'loaded' || listState.status === 'empty') && exists) {
      this.listStateValue.set({
        ...listState,
        data: listState.data.map((current) => (current.id === customer.id ? customer : current)),
      });
    }

    if (this.detailStateValue().data?.id === customer.id) {
      this.detailStateValue.set({ status: 'loaded', data: customer, error: null });
    }
  }
}
