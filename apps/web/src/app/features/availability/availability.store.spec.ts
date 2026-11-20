import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import { TenantResetRegistry } from '../../core/tenant/tenant-reset-registry.service';
import type { Dress } from '../dresses/dress.models';
import { AvailabilityApiService } from './availability-api.service';
import type { AvailabilityFilters, AvailabilityResponse } from './availability.models';
import { AvailabilityStore } from './availability.store';

const filters: AvailabilityFilters = {
  sucursalId: '11111111-1111-4111-8111-111111111111',
  fechaInicio: '2026-12-10T23:00:00.000Z',
  fechaFin: '2026-12-12T23:00:00.000Z',
  estadoOperativo: 'DISPONIBLE',
  page: 1,
  limit: 20,
};
const dress: Dress = {
  id: 'dress-1',
  sucursalId: filters.sucursalId,
  codigo: 'GALA-1',
  nombre: 'Gala',
  descripcion: null,
  talla: 'M',
  color: 'Rojo',
  marca: null,
  precioRenta: '100.00',
  deposito: null,
  estadoOperativo: 'DISPONIBLE',
  activo: true,
  createdAt: '',
  updatedAt: '',
  sucursal: { id: filters.sucursalId, nombre: 'Centro', activo: true },
};
const response: AvailabilityResponse = {
  data: [dress],
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  range: { fechaInicio: filters.fechaInicio, fechaFin: filters.fechaFin },
};

describe('AvailabilityStore', () => {
  const api = { find: vi.fn(() => of(response)) };
  beforeEach(() => {
    vi.clearAllMocks();
    api.find.mockReturnValue(of(response));
    TestBed.configureTestingModule({
      providers: [
        AvailabilityStore,
        TenantResetRegistry,
        { provide: AvailabilityApiService, useValue: api },
      ],
    });
  });

  it('loads paginated availability and range', async () => {
    const store = TestBed.inject(AvailabilityStore);
    await firstValueFrom(store.search(filters));
    expect(store.state()).toMatchObject({
      status: 'loaded',
      data: [dress],
      pagination: response.pagination,
      range: response.range,
    });
  });

  it('represents an empty result', async () => {
    api.find.mockReturnValueOnce(
      of({
        ...response,
        data: [],
        pagination: { ...response.pagination, total: 0, totalPages: 0 },
      }),
    );
    const store = TestBed.inject(AvailabilityStore);
    await firstValueFrom(store.search(filters));
    expect(store.state().status).toBe('empty');
  });

  it('keeps a tenant-safe branch 404', async () => {
    api.find.mockReturnValueOnce(
      throwError(
        () => new HttpErrorResponse({ status: 404, error: { message: 'Sucursal no encontrada' } }),
      ),
    );
    const store = TestBed.inject(AvailabilityStore);
    await firstValueFrom(store.search(filters));
    expect(store.state().error?.status).toBe(404);
    expect(JSON.stringify(store.state())).not.toMatch(/schemaName/);
  });

  it('clears data and cancels a pending response on tenant change', () => {
    const pending = new Subject<AvailabilityResponse>();
    api.find.mockReturnValueOnce(pending.asObservable());
    const store = TestBed.inject(AvailabilityStore);
    store.search(filters).subscribe();
    TestBed.inject(TenantResetRegistry).resetAll();
    pending.next(response);
    expect(store.state().status).toBe('idle');
    expect(store.state().data).toEqual([]);
  });
});
