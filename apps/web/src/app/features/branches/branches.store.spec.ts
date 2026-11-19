import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import { TenantResetRegistry } from '../../core/tenant/tenant-reset-registry.service';
import type { Branch } from './branch.models';
import { BranchesApiService } from './branches-api.service';
import { BranchesStore } from './branches.store';

const branch: Branch = {
  id: 'branch-1',
  nombre: 'Centro',
  direccion: 'Av. Principal 123',
  telefono: '555-0100',
  activo: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('BranchesStore', () => {
  const api = {
    list: vi.fn(),
    getById: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.list.mockReturnValue(of([branch]));
    api.getById.mockReturnValue(of(branch));
    TestBed.configureTestingModule({
      providers: [
        BranchesStore,
        TenantResetRegistry,
        { provide: BranchesApiService, useValue: api },
      ],
    });
  });

  it('loads the branch list', async () => {
    const store = TestBed.inject(BranchesStore);

    await firstValueFrom(store.loadList());

    expect(store.listState()).toEqual({ status: 'loaded', data: [branch], error: null });
  });

  it('represents an empty list explicitly', async () => {
    api.list.mockReturnValueOnce(of([]));
    const store = TestBed.inject(BranchesStore);

    await firstValueFrom(store.loadList());

    expect(store.listState()).toEqual({ status: 'empty', data: [], error: null });
  });

  it('loads one branch detail', async () => {
    const store = TestBed.inject(BranchesStore);

    await firstValueFrom(store.loadDetail(branch.id));

    expect(api.getById).toHaveBeenCalledWith(branch.id);
    expect(store.detailState()).toEqual({ status: 'loaded', data: branch, error: null });
  });

  it('keeps a 404 available for the detail UI', async () => {
    api.getById.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 404,
            error: { message: 'Sucursal no encontrada' },
          }),
      ),
    );
    const store = TestBed.inject(BranchesStore);

    await firstValueFrom(store.loadDetail('missing'));

    expect(store.detailState().status).toBe('error');
    expect(store.detailState().error?.status).toBe(404);
  });

  it('normalizes access and network errors', async () => {
    api.list.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 403, statusText: 'Forbidden' })),
    );
    const store = TestBed.inject(BranchesStore);
    await firstValueFrom(store.loadList());
    expect(store.listState().error?.status).toBe(403);

    api.list.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Network error' })),
    );
    await firstValueFrom(store.loadList());
    expect(store.listState().error?.status).toBe(0);
  });

  it('clears data and cancels an in-flight request when the tenant changes', () => {
    const response = new Subject<Branch[]>();
    api.list.mockReturnValueOnce(response.asObservable());
    const store = TestBed.inject(BranchesStore);
    const registry = TestBed.inject(TenantResetRegistry);
    store.loadList().subscribe();
    expect(store.listState().status).toBe('loading');

    registry.resetAll();
    response.next([branch]);

    expect(store.listState()).toEqual({ status: 'idle', data: [], error: null });
    expect(store.detailState()).toEqual({ status: 'idle', data: null, error: null });
  });

  it('does not expose schema information in branch state', async () => {
    const store = TestBed.inject(BranchesStore);
    await firstValueFrom(store.loadList());

    expect(JSON.stringify(store.listState())).not.toMatch(/schemaName|empresaSlug/);
  });
});
