import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import { TenantResetRegistry } from '../../core/tenant/tenant-reset-registry.service';
import type { Dress, PaginatedDressesResponse } from './dress.models';
import { DressesApiService } from './dresses-api.service';
import { DressesStore } from './dresses.store';

const dress: Dress = {
  id: 'dress-1',
  sucursalId: 'branch-1',
  codigo: 'GALA-001',
  nombre: 'Gala Roja',
  descripcion: 'Vestido largo',
  talla: 'M',
  color: 'Rojo',
  marca: 'Atelier',
  precioRenta: '1250.50',
  deposito: '500.00',
  estadoOperativo: 'DISPONIBLE',
  activo: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  sucursal: { id: 'branch-1', nombre: 'Centro', activo: true },
};

function response(data: Dress[] = [dress], page = 1): PaginatedDressesResponse {
  return {
    data,
    pagination: {
      page,
      limit: 20,
      total: data.length,
      totalPages: data.length === 0 ? 0 : 1,
    },
  };
}

describe('DressesStore', () => {
  const api = { list: vi.fn(), getById: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.list.mockReturnValue(of(response()));
    api.getById.mockReturnValue(of(dress));
    TestBed.configureTestingModule({
      providers: [DressesStore, TenantResetRegistry, { provide: DressesApiService, useValue: api }],
    });
  });

  it('loads a paginated catalog', async () => {
    const store = TestBed.inject(DressesStore);

    await firstValueFrom(store.loadList({ page: 1, limit: 20 }));

    expect(store.listState()).toMatchObject({
      status: 'loaded',
      data: [dress],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it('ignores an older search response', () => {
    const oldResponse = new Subject<PaginatedDressesResponse>();
    const newResponse = new Subject<PaginatedDressesResponse>();
    api.list
      .mockReturnValueOnce(oldResponse.asObservable())
      .mockReturnValueOnce(newResponse.asObservable());
    const store = TestBed.inject(DressesStore);
    store.loadList({ page: 1, limit: 20, q: 'Roja' }).subscribe();
    store.loadList({ page: 1, limit: 20, q: 'Azul' }).subscribe();
    const blue = { ...dress, id: 'dress-2', nombre: 'Gala Azul' };

    newResponse.next(response([blue]));
    oldResponse.next(response([dress]));

    expect(store.listState().data).toEqual([blue]);
    expect(store.listState().filters.q).toBe('Azul');
  });

  it('loads detail and keeps a tenant-safe 404', async () => {
    const store = TestBed.inject(DressesStore);
    await firstValueFrom(store.loadDetail(dress.id));
    expect(store.detailState()).toEqual({ status: 'loaded', data: dress, error: null });

    api.getById.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 404, error: { message: 'No encontrado' } })),
    );
    await firstValueFrom(store.loadDetail('missing'));
    expect(store.detailState().error?.status).toBe(404);
  });

  it('clears catalog, detail and pending responses on tenant change', async () => {
    const pending = new Subject<PaginatedDressesResponse>();
    api.list.mockReturnValueOnce(pending.asObservable());
    const store = TestBed.inject(DressesStore);
    const registry = TestBed.inject(TenantResetRegistry);
    await firstValueFrom(store.loadDetail(dress.id));
    store.loadList({ page: 1, limit: 20 }).subscribe();

    registry.resetAll();
    pending.next(response());

    expect(store.listState().status).toBe('idle');
    expect(store.detailState()).toEqual({ status: 'idle', data: null, error: null });
  });

  it('normalizes network errors without schema information', async () => {
    api.list.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Network error' })),
    );
    const store = TestBed.inject(DressesStore);

    await firstValueFrom(store.loadList({ page: 1, limit: 20 }));

    expect(store.listState().error?.status).toBe(0);
    expect(JSON.stringify(store.listState())).not.toMatch(/schemaName|empresaSlug/);
  });
});
