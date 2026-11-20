import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, Subject } from 'rxjs';
import { TenantResetRegistry } from '../../core/tenant/tenant-reset-registry.service';
import { AvailabilityApiService } from '../availability/availability-api.service';
import type { AvailabilityResponse } from '../availability/availability.models';
import { CustomersApiService } from '../customers/customers-api.service';
import type { Customer } from '../customers/customer.models';
import type { Dress } from '../dresses/dress.models';
import { ReservationCreateStore } from './reservation-create.store';
import type { CreateReservationInput, ReservationDetail } from './reservation.models';
import { ReservationsApiService } from './reservations-api.service';

const customer: Customer = {
  id: '11111111-1111-4111-8111-111111111111',
  nombre: 'Ana López',
  telefono: '555-0100',
  email: 'ana@example.com',
  direccion: null,
  notas: null,
  activo: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const dress: Dress = {
  id: '33333333-3333-4333-8333-333333333333',
  sucursalId: '22222222-2222-4222-8222-222222222222',
  codigo: 'GALA-01',
  nombre: 'Gala',
  descripcion: null,
  talla: 'M',
  color: 'Rojo',
  marca: null,
  precioRenta: '1200.50',
  deposito: '500.00',
  estadoOperativo: 'DISPONIBLE',
  activo: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  sucursal: { id: '22222222-2222-4222-8222-222222222222', nombre: 'Centro', activo: true },
};
const availability: AvailabilityResponse = {
  data: [dress],
  pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
  range: {
    fechaInicio: '2026-12-10T23:00:00.000Z',
    fechaFin: '2026-12-12T23:00:00.000Z',
  },
};
const input: CreateReservationInput = {
  clienteId: customer.id,
  sucursalId: dress.sucursalId,
  vestidoIds: [dress.id],
  fechaInicio: availability.range.fechaInicio,
  fechaFin: availability.range.fechaFin,
  notas: null,
  confirmar: true,
};
const created = { id: 'reservation-1' } as ReservationDetail;

describe('ReservationCreateStore', () => {
  const customersApi = { list: vi.fn() };
  const availabilityApi = { find: vi.fn() };
  const reservationsApi = { create: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    customersApi.list.mockReturnValue(
      of({ data: [customer], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } }),
    );
    availabilityApi.find.mockReturnValue(of(availability));
    reservationsApi.create.mockReturnValue(of(created));
    TestBed.configureTestingModule({
      providers: [
        ReservationCreateStore,
        TenantResetRegistry,
        { provide: CustomersApiService, useValue: customersApi },
        { provide: AvailabilityApiService, useValue: availabilityApi },
        { provide: ReservationsApiService, useValue: reservationsApi },
      ],
    });
  });

  it('searches only active customers with normalized pagination', async () => {
    const store = TestBed.inject(ReservationCreateStore);
    await firstValueFrom(store.searchCustomers('Ana'));

    expect(customersApi.list).toHaveBeenCalledWith({ page: 1, limit: 20, activo: true, q: 'Ana' });
    expect(store.customers()).toEqual([customer]);
    expect(store.customersStatus()).toBe('loaded');
  });

  it('loads calendar availability and exposes its state', async () => {
    const store = TestBed.inject(ReservationCreateStore);
    const filters = {
      sucursalId: dress.sucursalId,
      ...availability.range,
      estadoOperativo: 'DISPONIBLE' as const,
      page: 1,
      limit: 100,
    };
    await firstValueFrom(store.loadAvailability(filters));

    expect(availabilityApi.find).toHaveBeenCalledWith(filters);
    expect(store.availability()).toEqual(availability);
    expect(store.availabilityStatus()).toBe('loaded');
  });

  it('delegates creation without adding tenant selectors or amounts', async () => {
    const store = TestBed.inject(ReservationCreateStore);
    await firstValueFrom(store.create(input));

    expect(reservationsApi.create).toHaveBeenCalledWith(input);
    expect(JSON.stringify(reservationsApi.create.mock.calls)).not.toMatch(
      /importe|total|estado|empresaId|empresaSlug|schemaName/,
    );
  });

  it('clears supporting data and cancels tenant-bound requests', () => {
    const pending = new Subject<AvailabilityResponse>();
    availabilityApi.find.mockReturnValueOnce(pending.asObservable());
    const store = TestBed.inject(ReservationCreateStore);
    const registry = TestBed.inject(TenantResetRegistry);
    const received = vi.fn();
    store
      .loadAvailability({
        sucursalId: dress.sucursalId,
        ...availability.range,
        estadoOperativo: 'DISPONIBLE',
        page: 1,
        limit: 100,
      })
      .subscribe(received);

    registry.resetAll();
    pending.next(availability);

    expect(received).not.toHaveBeenCalled();
    expect(store.customers()).toEqual([]);
    expect(store.availability()).toBeNull();
    expect(store.availabilityStatus()).toBe('idle');
  });
});
