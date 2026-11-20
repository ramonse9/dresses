import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { BranchesStore } from '../branches/branches.store';
import { CustomersStore } from '../customers/customers.store';
import type { ReservationListState } from './reservation.models';
import { ReservationsListPageComponent } from './reservations-list-page.component';
import { ReservationsStore } from './reservations.store';

const customerId = '11111111-1111-4111-8111-111111111111';
const branchId = '22222222-2222-4222-8222-222222222222';
const reservationId = '33333333-3333-4333-8333-333333333333';
const customer = {
  id: customerId,
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
  id: branchId,
  nombre: 'Centro',
  direccion: null,
  telefono: null,
  activo: true,
  createdAt: '',
  updatedAt: '',
};
const loadedState: ReservationListState = {
  status: 'loaded',
  data: [
    {
      id: reservationId,
      cliente: {
        id: customerId,
        nombre: customer.nombre,
        telefono: customer.telefono,
        email: customer.email,
      },
      sucursal: { id: branchId, nombre: branch.nombre },
      fechaInicio: '2026-12-10T23:00:00.000Z',
      fechaFin: '2026-12-12T23:00:00.000Z',
      estado: 'CONFIRMADA',
      notas: null,
      importeRenta: '1250.50',
      depositoRequerido: '500.00',
      vestidosCount: 2,
      createdAt: '',
      updatedAt: '',
    },
  ],
  pagination: { page: 1, limit: 20, total: 41, totalPages: 3 },
  filters: { page: 1, limit: 20 },
  error: null,
};

describe('ReservationsListPageComponent', () => {
  const queryParamMap = new BehaviorSubject(convertToParamMap({}));
  const listState = signal<ReservationListState>(loadedState);
  const store = { listState: listState.asReadonly(), loadList: vi.fn(() => of(undefined)) };
  const customersStore = {
    listState: signal({
      status: 'loaded',
      data: [customer],
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
      filters: { page: 1, limit: 100 },
      error: null,
    }).asReadonly(),
    loadList: vi.fn(() => of(undefined)),
  };
  const branchesStore = {
    listState: signal({ status: 'loaded', data: [branch], error: null }).asReadonly(),
    loadList: vi.fn(() => of(undefined)),
  };
  const route = { queryParamMap: queryParamMap.asObservable() };
  let fixture: ComponentFixture<ReservationsListPageComponent>;
  let router: Router;

  beforeEach(async () => {
    vi.clearAllMocks();
    queryParamMap.next(convertToParamMap({}));
    listState.set(loadedState);
    await TestBed.configureTestingModule({
      imports: [ReservationsListPageComponent],
      providers: [
        provideRouter([]),
        { provide: ReservationsStore, useValue: store },
        { provide: CustomersStore, useValue: customersStore },
        { provide: BranchesStore, useValue: branchesStore },
        { provide: ActivatedRoute, useValue: route },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(ReservationsListPageComponent);
    fixture.detectChanges();
  });

  afterEach(() => vi.useRealTimers());

  it('renders customer, branch, range, state, totals and dress count', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Ana López');
    expect(text).toContain('Centro');
    expect(text).toContain('Confirmada');
    expect(text).toContain('$1,250.50');
    expect(text).toContain('$500.00');
    expect(text).toContain('2 vestidos');
    expect(text).toContain('Rango semiabierto');
    expect(
      fixture.nativeElement.querySelector('a[href="/app/reservaciones/nueva"]')?.textContent,
    ).toContain('Nueva reservación');
  });

  it('reads filters and pagination from query parameters', () => {
    queryParamMap.next(
      convertToParamMap({
        clienteId: customerId,
        sucursalId: branchId,
        estado: 'ENTREGADA',
        fechaDesde: '2026-12-10T23:00:00.000Z',
        fechaHasta: '2026-12-12T23:00:00.000Z',
        q: 'Ana',
        page: '2',
        limit: '50',
      }),
    );
    expect(store.loadList).toHaveBeenLastCalledWith(
      expect.objectContaining({
        clienteId: customerId,
        sucursalId: branchId,
        estado: 'ENTREGADA',
        q: 'Ana',
        page: 2,
        limit: 50,
      }),
    );
  });

  it('normalizes and debounces customer search', async () => {
    vi.useFakeTimers();
    fixture.componentInstance.filtersForm.controls.q.setValue('  Ana   López  ');
    await vi.advanceTimersByTimeAsync(350);
    expect(router.navigate).toHaveBeenCalledWith([], {
      relativeTo: route,
      queryParams: { q: 'Ana López', page: 1 },
      queryParamsHandling: 'merge',
    });
  });

  it('keeps pagination in query parameters', () => {
    fixture.componentInstance.goToPage(2);
    expect(router.navigate).toHaveBeenCalledWith([], {
      relativeTo: route,
      queryParams: { page: 2 },
      queryParamsHandling: 'merge',
    });
  });

  it('rejects an inverted date range', () => {
    fixture.componentInstance.filtersForm.patchValue({
      fechaDesde: '2026-12-12T16:00',
      fechaHasta: '2026-12-10T16:00',
    });
    fixture.componentInstance.applyDateRange();
    expect(fixture.componentInstance.dateError()).toContain('posterior');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('renders an empty result', () => {
    listState.set({
      ...loadedState,
      status: 'empty',
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No hay reservaciones registradas');
  });
});
