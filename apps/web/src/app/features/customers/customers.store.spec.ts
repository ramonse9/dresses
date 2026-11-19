import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import { TenantResetRegistry } from '../../core/tenant/tenant-reset-registry.service';
import type { Customer, PaginatedCustomersResponse } from './customer.models';
import { CustomersApiService } from './customers-api.service';
import { CustomersStore } from './customers.store';

const customer: Customer = {
  id: 'customer-1',
  nombre: 'Ana López',
  telefono: '555-0100',
  email: 'ana@example.com',
  direccion: 'Av. Principal 123',
  notas: 'Cliente frecuente',
  activo: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function response(
  data: Customer[] = [customer],
  page = 1,
  total = data.length,
): PaginatedCustomersResponse {
  return {
    data,
    pagination: { page, limit: 20, total, totalPages: total === 0 ? 0 : Math.ceil(total / 20) },
  };
}

describe('CustomersStore', () => {
  const api = {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    deactivate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.list.mockReturnValue(of(response()));
    api.getById.mockReturnValue(of(customer));
    api.create.mockReturnValue(of(customer));
    api.update.mockReturnValue(of(customer));
    api.updateStatus.mockReturnValue(of(customer));
    api.deactivate.mockReturnValue(of({ ...customer, activo: false }));
    TestBed.configureTestingModule({
      providers: [
        CustomersStore,
        TenantResetRegistry,
        { provide: CustomersApiService, useValue: api },
      ],
    });
  });

  it('loads the first paginated page', async () => {
    const store = TestBed.inject(CustomersStore);

    await firstValueFrom(store.loadList({ page: 1, limit: 20 }));

    expect(store.listState()).toMatchObject({
      status: 'loaded',
      data: [customer],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it('represents an empty page', async () => {
    api.list.mockReturnValueOnce(of(response([], 1, 0)));
    const store = TestBed.inject(CustomersStore);

    await firstValueFrom(store.loadList({ page: 1, limit: 20, q: 'Nadie' }));

    expect(store.listState().status).toBe('empty');
    expect(store.listState().data).toEqual([]);
    expect(store.listState().pagination.total).toBe(0);
  });

  it('ignores a stale response that arrives after a newer search', () => {
    const oldResponse = new Subject<PaginatedCustomersResponse>();
    const newResponse = new Subject<PaginatedCustomersResponse>();
    api.list
      .mockReturnValueOnce(oldResponse.asObservable())
      .mockReturnValueOnce(newResponse.asObservable());
    const store = TestBed.inject(CustomersStore);
    store.loadList({ page: 1, limit: 20, q: 'Ana' }).subscribe();
    store.loadList({ page: 1, limit: 20, q: 'Bea' }).subscribe();
    const bea = { ...customer, id: 'customer-2', nombre: 'Beatriz' };

    newResponse.next(response([bea]));
    oldResponse.next(response([customer]));

    expect(store.listState().data).toEqual([bea]);
    expect(store.listState().filters.q).toBe('Bea');
  });

  it('loads customer detail', async () => {
    const store = TestBed.inject(CustomersStore);

    await firstValueFrom(store.loadDetail(customer.id));

    expect(api.getById).toHaveBeenCalledWith(customer.id);
    expect(store.detailState()).toEqual({ status: 'loaded', data: customer, error: null });
  });

  it('keeps a detail 404 for the UI', async () => {
    api.getById.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 404, error: { message: 'No encontrado' } })),
    );
    const store = TestBed.inject(CustomersStore);

    await firstValueFrom(store.loadDetail('missing'));

    expect(store.detailState().status).toBe('error');
    expect(store.detailState().error?.status).toBe(404);
  });

  it('clears list, detail and pending responses when the tenant changes', async () => {
    const pending = new Subject<PaginatedCustomersResponse>();
    api.list.mockReturnValueOnce(pending.asObservable());
    const store = TestBed.inject(CustomersStore);
    const registry = TestBed.inject(TenantResetRegistry);
    await firstValueFrom(store.loadDetail(customer.id));
    store.loadList({ page: 2, limit: 20 }).subscribe();

    registry.resetAll();
    pending.next(response([customer], 2));

    expect(store.listState().status).toBe('idle');
    expect(store.listState().data).toEqual([]);
    expect(store.detailState()).toEqual({ status: 'idle', data: null, error: null });
  });

  it('normalizes list errors without exposing schema data', async () => {
    api.list.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Network error' })),
    );
    const store = TestBed.inject(CustomersStore);

    await firstValueFrom(store.loadList({ page: 1, limit: 20 }));

    expect(store.listState().error?.status).toBe(0);
    expect(JSON.stringify(store.listState())).not.toMatch(/schemaName|empresaSlug/);
  });

  it('creates and updates customers without adding activo to general data', async () => {
    const input = {
      nombre: 'Ana López',
      telefono: '555-0100',
      email: null,
      direccion: null,
      notas: null,
    };
    const updated = { ...customer, nombre: 'Ana María' };
    api.update.mockReturnValueOnce(of(updated));
    const store = TestBed.inject(CustomersStore);
    await firstValueFrom(store.loadList({ page: 1, limit: 20 }));
    await firstValueFrom(store.loadDetail(customer.id));

    await firstValueFrom(store.create(input));
    await firstValueFrom(store.update(customer.id, { ...input, nombre: updated.nombre }));

    expect(api.create).toHaveBeenCalledWith(input);
    expect(api.update).toHaveBeenCalledWith(customer.id, { ...input, nombre: updated.nombre });
    expect(store.detailState().data).toEqual(updated);
  });

  it('applies deactivation and reactivation only after successful responses', async () => {
    const inactive = { ...customer, activo: false };
    api.deactivate.mockReturnValueOnce(of(inactive));
    api.updateStatus.mockReturnValueOnce(of(customer));
    const store = TestBed.inject(CustomersStore);
    await firstValueFrom(store.loadList({ page: 1, limit: 20 }));
    await firstValueFrom(store.loadDetail(customer.id));

    await firstValueFrom(store.deactivate(customer.id));
    expect(store.detailState().data?.activo).toBe(false);
    await firstValueFrom(store.reactivate(customer.id));

    expect(api.updateStatus).toHaveBeenCalledWith(customer.id, true);
    expect(store.detailState().data?.activo).toBe(true);
  });

  it.each([400, 403, 404])(
    'does not alter local state when a mutation responds %s',
    async (status) => {
      api.update.mockReturnValueOnce(
        throwError(() => new HttpErrorResponse({ status, statusText: 'Rejected' })),
      );
      const store = TestBed.inject(CustomersStore);
      await firstValueFrom(store.loadList({ page: 1, limit: 20 }));
      await firstValueFrom(store.loadDetail(customer.id));
      const listBefore = store.listState();
      const detailBefore = store.detailState();

      await expect(
        firstValueFrom(
          store.update(customer.id, {
            nombre: 'Otro',
            telefono: null,
            email: 'otro@example.com',
            direccion: null,
            notas: null,
          }),
        ),
      ).rejects.toBeInstanceOf(HttpErrorResponse);

      expect(store.listState()).toBe(listBefore);
      expect(store.detailState()).toBe(detailBefore);
    },
  );

  it('cancels a pending mutation when the tenant changes', () => {
    const pending = new Subject<Customer>();
    api.create.mockReturnValueOnce(pending.asObservable());
    const store = TestBed.inject(CustomersStore);
    const registry = TestBed.inject(TenantResetRegistry);
    const received = vi.fn();
    store
      .create({
        nombre: 'Nueva',
        telefono: null,
        email: 'nueva@example.com',
        direccion: null,
        notas: null,
      })
      .subscribe(received);

    registry.resetAll();
    pending.next(customer);

    expect(received).not.toHaveBeenCalled();
    expect(store.listState().status).toBe('idle');
  });
});
