import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { TenantStore } from '../../core/tenant/tenant.store';
import { BranchesStore } from '../branches/branches.store';
import type { Customer } from '../customers/customer.models';
import type { Dress } from '../dresses/dress.models';
import { ReservationCreateStore } from './reservation-create.store';
import { ReservationEditPageComponent } from './reservation-edit-page.component';
import type { ReservationDetail, UpdateReservationInput } from './reservation.models';
import { ReservationsStore } from './reservations.store';

const reservationId = '44444444-4444-4444-8444-444444444444';
const customer: Customer = {
  id: '11111111-1111-4111-8111-111111111111',
  nombre: 'Ana López',
  telefono: '555',
  email: 'ana@example.com',
  direccion: null,
  notas: null,
  activo: true,
  createdAt: '',
  updatedAt: '',
};
const branch = {
  id: '22222222-2222-4222-8222-222222222222',
  nombre: 'Centro',
  direccion: null,
  telefono: null,
  activo: true,
  createdAt: '',
  updatedAt: '',
};
const newDress: Dress = {
  id: '33333333-3333-4333-8333-333333333334',
  sucursalId: branch.id,
  codigo: 'NUEVO-02',
  nombre: 'Nueva pieza',
  descripcion: null,
  talla: 'M',
  color: 'Azul',
  marca: null,
  precioRenta: '900.00',
  deposito: '300.00',
  estadoOperativo: 'DISPONIBLE',
  activo: true,
  createdAt: '',
  updatedAt: '',
  sucursal: { id: branch.id, nombre: branch.nombre, activo: true },
};
const baseDetail: ReservationDetail = {
  id: reservationId,
  cliente: {
    id: customer.id,
    nombre: customer.nombre,
    telefono: customer.telefono,
    email: customer.email,
  },
  sucursal: { id: branch.id, nombre: branch.nombre },
  fechaInicio: '2026-12-10T23:00:00.000Z',
  fechaFin: '2026-12-12T23:00:00.000Z',
  estado: 'BORRADOR',
  notas: 'Prueba',
  importeRenta: '1000.00',
  depositoRequerido: '400.00',
  vestidos: [
    {
      id: '33333333-3333-4333-8333-333333333333',
      codigo: 'HIST-01',
      nombre: 'Pieza histórica',
      talla: 'M',
      color: 'Rojo',
      precioRenta: '1000.00',
      deposito: '400.00',
    },
  ],
  confirmadaAt: null,
  entregadaAt: null,
  devueltaAt: null,
  canceladaAt: null,
  motivoCancelacion: null,
  createdAt: '',
  updatedAt: '',
};
const availabilityResponse = {
  data: [newDress],
  pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
  range: { fechaInicio: baseDetail.fechaInicio, fechaFin: baseDetail.fechaFin },
};

describe('ReservationEditPageComponent', () => {
  const role = signal<'OWNER' | 'EMPLOYEE'>('OWNER');
  const detailState = signal({ status: 'loaded' as const, data: baseDetail, error: null });
  const reservationStore = {
    detailState: detailState.asReadonly(),
    loadDetail: vi.fn(() => of(undefined)),
    update: vi.fn((_id: string, _input: UpdateReservationInput) => of(baseDetail)),
  };
  const customers = signal<readonly Customer[]>([customer]);
  const availability = signal(availabilityResponse);
  const supportStore = {
    customers: customers.asReadonly(),
    customersStatus: signal('loaded').asReadonly(),
    availability: availability.asReadonly(),
    availabilityStatus: signal('loaded').asReadonly(),
    searchCustomers: vi.fn(() => of(undefined)),
    loadAvailability: vi.fn(() => of(availability())),
    clearAvailability: vi.fn(),
  };
  const branchesStore = {
    listState: signal({ status: 'loaded', data: [branch], error: null }).asReadonly(),
    loadList: vi.fn(() => of(undefined)),
  };
  let fixture: ComponentFixture<ReservationEditPageComponent>;
  let component: ReservationEditPageComponent;
  let router: Router;

  beforeEach(async () => {
    vi.clearAllMocks();
    role.set('OWNER');
    detailState.set({ status: 'loaded', data: baseDetail, error: null });
    reservationStore.loadDetail.mockReturnValue(of(undefined));
    reservationStore.update.mockReturnValue(of(baseDetail));
    supportStore.loadAvailability.mockImplementation(() => of(availability()));
    const paramMap = convertToParamMap({ id: reservationId });
    const queryParamMap = convertToParamMap({ page: '2' });
    await TestBed.configureTestingModule({
      imports: [ReservationEditPageComponent],
      providers: [
        provideRouter([]),
        { provide: ReservationsStore, useValue: reservationStore },
        { provide: ReservationCreateStore, useValue: supportStore },
        { provide: BranchesStore, useValue: branchesStore },
        { provide: TenantStore, useValue: { role: role.asReadonly() } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap, queryParamMap } },
        },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(ReservationEditPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it.each(['BORRADOR', 'CONFIRMADA'] as const)('updates an editable %s reservation', (estado) => {
    detailState.set({ status: 'loaded', data: { ...baseDetail, estado }, error: null });
    component.toggleDress(newDress);
    component.submit();

    expect(reservationStore.update).toHaveBeenCalledOnce();
    const input = reservationStore.update.mock.calls[0][1];
    expect(input.vestidoIds).toEqual([baseDetail.vestidos[0].id, newDress.id]);
    expect(input).toMatchObject({
      clienteId: customer.id,
      sucursalId: branch.id,
      notas: 'Prueba',
    });
    expect(JSON.stringify(input)).not.toMatch(/estado|importe|total|schemaName|empresaId/);
  });

  it('renders historical snapshots separately from current prices', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Precio histórico $1,000.00');
    expect(text).toContain('Las piezas nuevas tomarán el precio y depósito actuales');
    expect(text).toContain('Precio actual $900.00');
  });

  it.each(['ENTREGADA', 'DEVUELTA', 'CANCELADA'] as const)(
    'does not allow editing in %s',
    (estado) => {
      detailState.set({ status: 'loaded', data: { ...baseDetail, estado }, error: null });
      fixture.detectChanges();
      component.submit();
      expect(fixture.nativeElement.textContent).toContain('ya no puede editarse');
      expect(reservationStore.update).not.toHaveBeenCalled();
    },
  );

  it('clears dress selection when the branch changes', () => {
    component.form.controls.sucursalId.setValue('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(component.selectedDressIds()).toEqual([]);
  });

  it('handles a concurrent 409 by refreshing detail and availability', () => {
    reservationStore.update.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 409, statusText: 'Conflict' })),
    );
    component.submit();
    expect(component.formError()).toContain('cambió');
    expect(reservationStore.loadDetail).toHaveBeenCalledTimes(2);
    expect(supportStore.loadAvailability).toHaveBeenCalled();
  });

  it('does not alter local state after a forced 403', () => {
    reservationStore.update.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 403, statusText: 'Forbidden' })),
    );
    const before = component.selectedDressIds();
    component.submit();
    expect(component.formError()).toContain('autorización');
    expect(component.selectedDressIds()).toEqual(before);
  });

  it('blocks duplicate update submissions', () => {
    const pending = new Subject<ReservationDetail>();
    reservationStore.update.mockReturnValueOnce(pending.asObservable());
    component.submit();
    component.submit();
    expect(reservationStore.update).toHaveBeenCalledOnce();
    expect(component.submitting()).toBe(true);
    pending.next(baseDetail);
    pending.complete();
    expect(component.submitting()).toBe(false);
  });
});
