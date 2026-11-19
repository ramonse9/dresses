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
    create: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.list.mockReturnValue(of([branch]));
    api.getById.mockReturnValue(of(branch));
    api.create.mockReturnValue(of(branch));
    api.update.mockReturnValue(of(branch));
    api.deactivate.mockReturnValue(of({ ...branch, activo: false }));
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

  it('adds a created branch to an already loaded list', async () => {
    const created = { ...branch, id: 'branch-2', nombre: 'Norte' };
    api.create.mockReturnValueOnce(of(created));
    const store = TestBed.inject(BranchesStore);
    await firstValueFrom(store.loadList());

    await firstValueFrom(
      store.create({ nombre: created.nombre, direccion: created.direccion, telefono: null }),
    );

    expect(store.listState().data).toEqual([created, branch]);
  });

  it('updates branch data only after a successful response', async () => {
    const updated = { ...branch, nombre: 'Centro Histórico' };
    api.update.mockReturnValueOnce(of(updated));
    const store = TestBed.inject(BranchesStore);
    await firstValueFrom(store.loadList());
    await firstValueFrom(store.loadDetail(branch.id));

    await firstValueFrom(
      store.update(branch.id, { nombre: updated.nombre, direccion: null, telefono: null }),
    );

    expect(store.listState().data[0]).toEqual(updated);
    expect(store.detailState().data).toEqual(updated);
  });

  it('applies logical deactivation and reactivation responses', async () => {
    const inactive = { ...branch, activo: false };
    api.deactivate.mockReturnValueOnce(of(inactive));
    api.update.mockReturnValueOnce(of(branch));
    const store = TestBed.inject(BranchesStore);
    await firstValueFrom(store.loadList());
    await firstValueFrom(store.loadDetail(branch.id));

    await firstValueFrom(store.deactivate(branch.id));
    expect(store.detailState().data?.activo).toBe(false);
    await firstValueFrom(store.reactivate(branch.id));
    expect(api.update).toHaveBeenCalledWith(branch.id, { activo: true });
    expect(store.detailState().data?.activo).toBe(true);
  });

  it.each([403, 409])('does not alter local state when a mutation responds %s', async (status) => {
    api.update.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status, statusText: 'Rejected' })),
    );
    const store = TestBed.inject(BranchesStore);
    await firstValueFrom(store.loadList());
    await firstValueFrom(store.loadDetail(branch.id));
    const listBefore = store.listState();
    const detailBefore = store.detailState();

    await expect(
      firstValueFrom(
        store.update(branch.id, { nombre: 'Duplicada', direccion: null, telefono: null }),
      ),
    ).rejects.toBeInstanceOf(HttpErrorResponse);

    expect(store.listState()).toBe(listBefore);
    expect(store.detailState()).toBe(detailBefore);
  });

  it('cancels a pending mutation when the tenant changes', () => {
    const response = new Subject<Branch>();
    api.create.mockReturnValueOnce(response.asObservable());
    const store = TestBed.inject(BranchesStore);
    const registry = TestBed.inject(TenantResetRegistry);
    const received = vi.fn();
    store.create({ nombre: 'Norte', direccion: null, telefono: null }).subscribe(received);

    registry.resetAll();
    response.next({ ...branch, id: 'branch-2' });

    expect(received).not.toHaveBeenCalled();
    expect(store.listState()).toEqual({ status: 'idle', data: [], error: null });
  });

  it('does not expose schema information in branch state', async () => {
    const store = TestBed.inject(BranchesStore);
    await firstValueFrom(store.loadList());

    expect(JSON.stringify(store.listState())).not.toMatch(/schemaName|empresaSlug/);
  });
});
