import { inject, Injectable, signal } from '@angular/core';
import {
  catchError,
  finalize,
  map,
  Observable,
  of,
  shareReplay,
  Subject,
  takeUntil,
  tap,
} from 'rxjs';
import { normalizeApiError } from '../../core/http/api-error';
import { TenantResetRegistry } from '../../core/tenant/tenant-reset-registry.service';
import type {
  Branch,
  BranchResourceState,
  CreateBranchInput,
  UpdateBranchInput,
} from './branch.models';
import { BranchesApiService } from './branches-api.service';

const initialListState: BranchResourceState<readonly Branch[]> = {
  status: 'idle',
  data: [],
  error: null,
};

const initialDetailState: BranchResourceState<Branch | null> = {
  status: 'idle',
  data: null,
  error: null,
};

@Injectable({ providedIn: 'root' })
export class BranchesStore {
  private readonly api = inject(BranchesApiService);
  private readonly resetRegistry = inject(TenantResetRegistry);
  private readonly resetRequests = new Subject<void>();
  private readonly listStateValue = signal(initialListState);
  private readonly detailStateValue = signal(initialDetailState);
  private listInFlight: Observable<void> | null = null;
  private detailRequestId = 0;
  private tenantGeneration = 0;

  readonly listState = this.listStateValue.asReadonly();
  readonly detailState = this.detailStateValue.asReadonly();

  constructor() {
    this.resetRegistry.register(() => this.reset());
  }

  loadList(): Observable<void> {
    if (this.listInFlight) {
      return this.listInFlight;
    }

    this.listStateValue.set({ status: 'loading', data: [], error: null });
    this.listInFlight = this.api.list().pipe(
      takeUntil(this.resetRequests),
      tap((branches) => {
        this.listStateValue.set({
          status: branches.length === 0 ? 'empty' : 'loaded',
          data: branches,
          error: null,
        });
      }),
      map(() => undefined),
      catchError((error: unknown) => {
        this.listStateValue.set({ status: 'error', data: [], error: normalizeApiError(error) });
        return of(undefined);
      }),
      finalize(() => {
        this.listInFlight = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    return this.listInFlight;
  }

  loadDetail(id: string): Observable<void> {
    const requestId = ++this.detailRequestId;
    this.detailStateValue.set({ status: 'loading', data: null, error: null });

    return this.api.getById(id).pipe(
      takeUntil(this.resetRequests),
      tap((branch) => {
        if (requestId === this.detailRequestId) {
          this.detailStateValue.set({ status: 'loaded', data: branch, error: null });
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

  create(input: CreateBranchInput): Observable<Branch> {
    return this.runMutation(this.api.create(input));
  }

  update(id: string, input: UpdateBranchInput): Observable<Branch> {
    return this.runMutation(this.api.update(id, input));
  }

  deactivate(id: string): Observable<Branch> {
    return this.runMutation(this.api.deactivate(id));
  }

  reactivate(id: string): Observable<Branch> {
    return this.runMutation(this.api.update(id, { activo: true }));
  }

  reset(): void {
    this.tenantGeneration += 1;
    this.detailRequestId += 1;
    this.resetRequests.next();
    this.listInFlight = null;
    this.listStateValue.set(initialListState);
    this.detailStateValue.set(initialDetailState);
  }

  private runMutation(request: Observable<Branch>): Observable<Branch> {
    const generation = this.tenantGeneration;
    return request.pipe(
      takeUntil(this.resetRequests),
      tap((branch) => {
        if (generation === this.tenantGeneration) {
          this.applyMutation(branch);
        }
      }),
    );
  }

  private applyMutation(branch: Branch): void {
    const listState = this.listStateValue();
    if (listState.status === 'loaded' || listState.status === 'empty') {
      const exists = listState.data.some(({ id }) => id === branch.id);
      const data = exists
        ? listState.data.map((current) => (current.id === branch.id ? branch : current))
        : [branch, ...listState.data];
      this.listStateValue.set({ status: 'loaded', data, error: null });
    }

    if (this.detailStateValue().data?.id === branch.id) {
      this.detailStateValue.set({ status: 'loaded', data: branch, error: null });
    }
  }
}
