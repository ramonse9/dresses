import { inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, Subject, takeUntil, tap } from 'rxjs';
import { normalizeApiError } from '../../core/http/api-error';
import { TenantResetRegistry } from '../../core/tenant/tenant-reset-registry.service';
import { DEFAULT_DRESS_LIMIT, DEFAULT_DRESS_PAGE } from './dress-filters';
import type {
  CreateDressInput,
  DressDetailState,
  DressListFilters,
  DressListState,
  DressMutationResult,
  UpdateDressInput,
} from './dress.models';
import { DressesApiService } from './dresses-api.service';

const defaultFilters: DressListFilters = {
  page: DEFAULT_DRESS_PAGE,
  limit: DEFAULT_DRESS_LIMIT,
};

const initialListState: DressListState = {
  status: 'idle',
  data: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  filters: defaultFilters,
  error: null,
};

const initialDetailState: DressDetailState = {
  status: 'idle',
  data: null,
  error: null,
};

@Injectable({ providedIn: 'root' })
export class DressesStore {
  private readonly api = inject(DressesApiService);
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

  loadList(filters: DressListFilters): Observable<void> {
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
      tap((dress) => {
        if (requestId === this.detailRequestId) {
          this.detailStateValue.set({ status: 'loaded', data: dress, error: null });
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

  create(input: CreateDressInput): Observable<DressMutationResult> {
    return this.runMutation(this.api.create(input));
  }

  update(id: string, input: UpdateDressInput): Observable<DressMutationResult> {
    return this.runMutation(this.api.update(id, input));
  }

  deactivate(id: string): Observable<DressMutationResult> {
    return this.runMutation(this.api.deactivate(id));
  }

  reactivate(id: string): Observable<DressMutationResult> {
    return this.runMutation(this.api.update(id, { activo: true }));
  }

  reset(): void {
    this.tenantGeneration += 1;
    this.listRequestId += 1;
    this.detailRequestId += 1;
    this.resetRequests.next();
    this.listStateValue.set(initialListState);
    this.detailStateValue.set(initialDetailState);
  }

  private runMutation(request: Observable<DressMutationResult>): Observable<DressMutationResult> {
    const generation = this.tenantGeneration;
    return request.pipe(
      takeUntil(this.resetRequests),
      tap((result) => {
        if (generation === this.tenantGeneration) {
          this.mergeMutationResult(result);
        }
      }),
    );
  }

  private mergeMutationResult(result: DressMutationResult): void {
    const detail = this.detailStateValue().data;
    const listed = this.listStateValue().data.find(({ id }) => id === result.id);
    const current = detail?.id === result.id ? detail : listed;

    // Las mutaciones no incluyen la relación `sucursal`. Si hubo un traslado,
    // la vista siguiente vuelve a consultar el detalle para no conservar una relación obsoleta.
    if (!current || current.sucursalId !== result.sucursalId) {
      return;
    }

    const merged = { ...current, ...result };
    if (detail?.id === result.id) {
      this.detailStateValue.set({ status: 'loaded', data: merged, error: null });
    }
    const list = this.listStateValue();
    if (listed) {
      this.listStateValue.set({
        ...list,
        data: list.data.map((dress) => (dress.id === result.id ? merged : dress)),
      });
    }
  }
}
