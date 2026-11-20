import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { BranchesStore } from '../branches/branches.store';
import type { Customer } from '../customers/customer.models';
import type { Dress } from '../dresses/dress.models';
import { ReservationCreatePageComponent } from './reservation-create-page.component';
import { ReservationCreateStore } from './reservation-create.store';
import type { CreateReservationInput, ReservationDetail } from './reservation.models';

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
const branches = [
  {
    id: '22222222-2222-4222-8222-222222222222',
    nombre: 'Centro',
    direccion: null,
    telefono: null,
    activo: true,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    nombre: 'Norte',
    direccion: null,
    telefono: null,
    activo: true,
    createdAt: '',
    updatedAt: '',
  },
];
const dress = createDress(0);
const initialAvailability = {
  data: [dress],
  pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
  range: {
    fechaInicio: '2026-12-10T23:00:00.000Z',
    fechaFin: '2026-12-12T23:00:00.000Z',
  },
};
const createdReservation = {
  id: '44444444-4444-4444-8444-444444444444',
  cliente: {
    id: customer.id,
    nombre: customer.nombre,
    telefono: customer.telefono,
    email: customer.email,
  },
  sucursal: { id: branches[0].id, nombre: branches[0].nombre },
  fechaInicio: initialAvailability.range.fechaInicio,
  fechaFin: initialAvailability.range.fechaFin,
  estado: 'CONFIRMADA',
  notas: null,
  importeRenta: dress.precioRenta,
  depositoRequerido: dress.deposito,
  vestidos: [
    {
      id: dress.id,
      codigo: dress.codigo,
      nombre: dress.nombre,
      talla: dress.talla,
      color: dress.color,
      precioRenta: dress.precioRenta,
      deposito: dress.deposito,
    },
  ],
  confirmadaAt: '2026-11-01T00:00:00.000Z',
  entregadaAt: null,
  devueltaAt: null,
  canceladaAt: null,
  motivoCancelacion: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
} as ReservationDetail;

describe('ReservationCreatePageComponent', () => {
  const customers = signal<readonly Customer[]>([customer]);
  const customersStatus = signal<'loaded'>('loaded');
  const availability = signal(initialAvailability);
  const availabilityStatus = signal<'loaded'>('loaded');
  const store = {
    customers: customers.asReadonly(),
    customersStatus: customersStatus.asReadonly(),
    availability: availability.asReadonly(),
    availabilityStatus: availabilityStatus.asReadonly(),
    searchCustomers: vi.fn(() => of(undefined)),
    loadAvailability: vi.fn(() => of(availability())),
    clearAvailability: vi.fn(),
    create: vi.fn((_input: CreateReservationInput) => of(createdReservation)),
  };
  const branchesStore = {
    listState: signal({ status: 'loaded', data: branches, error: null }).asReadonly(),
    loadList: vi.fn(() => of(undefined)),
  };
  let fixture: ComponentFixture<ReservationCreatePageComponent>;
  let component: ReservationCreatePageComponent;
  let router: Router;

  beforeEach(async () => {
    vi.clearAllMocks();
    customers.set([customer]);
    availability.set(initialAvailability);
    store.searchCustomers.mockReturnValue(of(undefined));
    store.loadAvailability.mockImplementation(() => of(availability()));
    store.create.mockReturnValue(of(createdReservation));
    await TestBed.configureTestingModule({
      imports: [ReservationCreatePageComponent],
      providers: [
        provideRouter([]),
        { provide: ReservationCreateStore, useValue: store },
        { provide: BranchesStore, useValue: branchesStore },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(ReservationCreatePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => vi.useRealTimers());

  it('selects an active customer and creates a confirmed reservation by default', () => {
    prepareValidForm();
    component.submit();

    expect(store.create).toHaveBeenCalledOnce();
    const payload = store.create.mock.calls[0][0] as CreateReservationInput;
    expect(payload).toMatchObject({
      clienteId: customer.id,
      sucursalId: branches[0].id,
      vestidoIds: [dress.id],
      confirmar: true,
    });
    expect(payload.fechaInicio).toMatch(/Z$/);
    expect(payload.fechaFin).toMatch(/Z$/);
    expect(JSON.stringify(payload)).not.toMatch(
      /importe|total|estado|empresaId|empresaSlug|schemaName/,
    );
    expect(router.navigate).toHaveBeenCalledWith(['/app/reservaciones', createdReservation.id]);
  });

  it('can save the same valid flow as a draft', () => {
    prepareValidForm();
    component.form.controls.confirmar.setValue(false);
    component.submit();

    expect(store.create).toHaveBeenCalledWith(expect.objectContaining({ confirmar: false }));
  });

  it('clears selected dresses when the branch changes', () => {
    prepareValidForm();
    expect(component.selectedBranchName()).toBe('Centro');
    component.form.controls.sucursalId.setValue(branches[1].id);

    expect(component.selectedDressIds()).toEqual([]);
    expect(component.selectedBranchName()).toBe('Norte');
    expect(store.loadAvailability).toHaveBeenLastCalledWith(
      expect.objectContaining({ sucursalId: branches[1].id }),
    );
  });

  it('clears the selection and requeries availability when dates change', () => {
    prepareValidForm();
    const callsBefore = store.loadAvailability.mock.calls.length;
    component.form.controls.fechaFin.setValue('2026-12-13T16:00');
    component.refreshAfterDateChange();

    expect(component.selectedDressIds()).toEqual([]);
    expect(store.loadAvailability.mock.calls.length).toBe(callsBefore + 1);
  });

  it('prevents duplicate selections and enforces the 50-piece maximum', () => {
    const dresses = Array.from({ length: 51 }, (_, index) => createDress(index));
    availability.set({
      ...initialAvailability,
      data: dresses,
      pagination: { page: 1, limit: 100, total: 51, totalPages: 1 },
    });
    dresses.slice(0, 50).forEach((item) => component.toggleDress(item));
    component.toggleDress(dresses[0]);
    component.toggleDress(dresses[0]);
    component.toggleDress(dresses[50]);

    expect(component.selectedDressIds()).toHaveLength(50);
    expect(new Set(component.selectedDressIds()).size).toBe(50);
    expect(component.selectionError()).toContain('máximo 50');
  });

  it('preserves valid form values and refreshes availability after a 409', () => {
    prepareValidForm();
    store.create.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 409, statusText: 'Conflict' })),
    );
    availability.set({
      ...initialAvailability,
      data: [],
      pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
    });

    component.submit();

    expect(component.form.controls.clienteId.value).toBe(customer.id);
    expect(component.form.controls.sucursalId.value).toBe(branches[0].id);
    expect(component.form.controls.fechaInicio.value).toBe('2026-12-10T16:00');
    expect(component.conflictMessage()).toContain('dejaron de estar disponibles');
    expect(store.loadAvailability).toHaveBeenCalled();
    expect(component.selectedDressIds()).toEqual([]);
  });

  it('blocks duplicate submissions while the first request is pending', () => {
    prepareValidForm();
    const pending = new Subject<ReservationDetail>();
    store.create.mockReturnValueOnce(pending.asObservable());

    component.submit();
    component.submit();

    expect(store.create).toHaveBeenCalledOnce();
    expect(component.submitting()).toBe(true);
    pending.next(createdReservation);
    pending.complete();
    expect(component.submitting()).toBe(false);
  });

  it('renders one creation flow for both authorized roles without owner-only controls', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Crear reservación');
    expect(text).toContain('Guardar como borrador');
    expect(text).not.toContain('Solo OWNER');
  });

  function prepareValidForm(): void {
    component.selectCustomer(customer);
    component.form.patchValue({
      sucursalId: branches[0].id,
      fechaInicio: '2026-12-10T16:00',
      fechaFin: '2026-12-12T16:00',
    });
    component.refreshAfterDateChange();
    component.toggleDress(dress);
  }
});

function createDress(index: number): Dress {
  return {
    id: `33333333-3333-4333-8333-${String(index).padStart(12, '0')}`,
    sucursalId: branches[0].id,
    codigo: `GALA-${String(index).padStart(2, '0')}`,
    nombre: `Gala ${index}`,
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
    sucursal: { id: branches[0].id, nombre: branches[0].nombre, activo: true },
  };
}
