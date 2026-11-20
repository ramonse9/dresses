import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import { TenantResetRegistry } from '../../core/tenant/tenant-reset-registry.service';
import type { PaginatedReservationsResponse, ReservationDetail } from './reservation.models';
import { ReservationsApiService } from './reservations-api.service';
import { ReservationsStore } from './reservations.store';

const detail: ReservationDetail = {
  id: 'reservation-1',
  cliente: { id: 'customer-1', nombre: 'Ana López', telefono: '555', email: 'ana@example.com' },
  sucursal: { id: 'branch-1', nombre: 'Centro' },
  fechaInicio: '2026-12-10T23:00:00.000Z',
  fechaFin: '2026-12-12T23:00:00.000Z',
  estado: 'CONFIRMADA',
  notas: 'Prueba',
  importeRenta: '1250.50',
  depositoRequerido: '500.00',
  vestidos: [
    {
      id: 'dress-1',
      codigo: 'GALA-1',
      nombre: 'Gala',
      talla: 'M',
      color: 'Rojo',
      precioRenta: '1250.50',
      deposito: '500.00',
    },
  ],
  confirmadaAt: '2026-11-01T00:00:00.000Z',
  entregadaAt: null,
  devueltaAt: null,
  canceladaAt: null,
  motivoCancelacion: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};
const {
  vestidos: _vestidos,
  confirmadaAt: _confirmadaAt,
  entregadaAt: _entregadaAt,
  devueltaAt: _devueltaAt,
  canceladaAt: _canceladaAt,
  motivoCancelacion: _motivoCancelacion,
  ...listDetail
} = detail;
const response: PaginatedReservationsResponse = {
  data: [{ ...listDetail, vestidosCount: 1 }],
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

describe('ReservationsStore', () => {
  const api = {
    list: vi.fn(() => of(response)),
    getById: vi.fn(() => of(detail)),
    update: vi.fn(() => of(detail)),
    confirm: vi.fn(() => of(detail)),
    deliver: vi.fn(() => of(detail)),
    returnReservation: vi.fn(() => of(detail)),
    cancel: vi.fn(() => of(detail)),
  };
  beforeEach(() => {
    vi.clearAllMocks();
    api.list.mockReturnValue(of(response));
    api.getById.mockReturnValue(of(detail));
    api.update.mockReturnValue(of(detail));
    api.confirm.mockReturnValue(of(detail));
    api.deliver.mockReturnValue(of(detail));
    api.returnReservation.mockReturnValue(of(detail));
    api.cancel.mockReturnValue(of(detail));
    TestBed.configureTestingModule({
      providers: [
        ReservationsStore,
        TenantResetRegistry,
        { provide: ReservationsApiService, useValue: api },
      ],
    });
  });

  it('loads list and complete detail', async () => {
    const store = TestBed.inject(ReservationsStore);
    await firstValueFrom(store.loadList({ page: 1, limit: 20 }));
    await firstValueFrom(store.loadDetail(detail.id));
    expect(store.listState()).toMatchObject({ status: 'loaded', pagination: response.pagination });
    expect(store.detailState()).toEqual({ status: 'loaded', data: detail, error: null });
  });

  it('keeps tenant-safe 404 details', async () => {
    api.getById.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 404, error: { message: 'No encontrada' } })),
    );
    const store = TestBed.inject(ReservationsStore);
    await firstValueFrom(store.loadDetail('missing'));
    expect(store.detailState().error?.status).toBe(404);
    expect(JSON.stringify(store.detailState())).not.toMatch(/schemaName/);
  });

  it('clears list, detail and pending responses on tenant change', async () => {
    const pending = new Subject<PaginatedReservationsResponse>();
    api.list.mockReturnValueOnce(pending.asObservable());
    const store = TestBed.inject(ReservationsStore);
    await firstValueFrom(store.loadDetail(detail.id));
    store.loadList({ page: 1, limit: 20 }).subscribe();
    TestBed.inject(TenantResetRegistry).resetAll();
    pending.next(response);
    expect(store.listState().status).toBe('idle');
    expect(store.detailState()).toEqual({ status: 'idle', data: null, error: null });
  });

  it('delegates updates and every explicit transition', async () => {
    const store = TestBed.inject(ReservationsStore);
    const input = {
      clienteId: detail.cliente.id,
      sucursalId: detail.sucursal.id,
      vestidoIds: detail.vestidos.map(({ id }) => id),
      fechaInicio: detail.fechaInicio,
      fechaFin: detail.fechaFin,
      notas: detail.notas,
    };
    await firstValueFrom(store.update(detail.id, input));
    await firstValueFrom(store.confirm(detail.id));
    await firstValueFrom(store.deliver(detail.id));
    await firstValueFrom(store.returnReservation(detail.id));
    await firstValueFrom(store.cancel(detail.id, { motivo: 'Cambio' }));

    expect(api.update).toHaveBeenCalledWith(detail.id, input);
    expect(api.confirm).toHaveBeenCalledWith(detail.id);
    expect(api.deliver).toHaveBeenCalledWith(detail.id);
    expect(api.returnReservation).toHaveBeenCalledWith(detail.id);
    expect(api.cancel).toHaveBeenCalledWith(detail.id, { motivo: 'Cambio' });
  });
});
