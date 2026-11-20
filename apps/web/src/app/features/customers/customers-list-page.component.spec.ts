import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import type { Customer, CustomerListState } from './customer.models';
import { CustomersListPageComponent } from './customers-list-page.component';
import { CustomersStore } from './customers.store';

const customer: Customer = {
  id: '11111111-1111-4111-8111-111111111111',
  nombre: 'Ana López',
  telefono: '555-0100',
  email: 'ana@example.com',
  direccion: 'Av. Principal 123',
  notas: 'Cliente frecuente',
  activo: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const loadedState: CustomerListState = {
  status: 'loaded',
  data: [customer],
  pagination: { page: 1, limit: 20, total: 41, totalPages: 3 },
  filters: { page: 1, limit: 20 },
  error: null,
};

describe('CustomersListPageComponent', () => {
  const queryParamMap = new BehaviorSubject(convertToParamMap({}));
  const listState = signal<CustomerListState>(loadedState);
  const store = {
    listState: listState.asReadonly(),
    loadList: vi.fn(() => of(undefined)),
  };
  const route = {
    queryParamMap: queryParamMap.asObservable(),
    snapshot: { queryParamMap: queryParamMap.value },
  };
  let fixture: ComponentFixture<CustomersListPageComponent>;
  let router: Router;

  beforeEach(async () => {
    vi.clearAllMocks();
    queryParamMap.next(convertToParamMap({}));
    listState.set(loadedState);
    route.snapshot.queryParamMap = queryParamMap.value;
    TestBed.configureTestingModule({
      imports: [CustomersListPageComponent],
      providers: [
        provideRouter([]),
        { provide: CustomersStore, useValue: store },
        { provide: ActivatedRoute, useValue: route },
      ],
    });
    await TestBed.compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(CustomersListPageComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads the first page and renders customer data', () => {
    expect(store.loadList).toHaveBeenCalledWith({ page: 1, limit: 20 });
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Ana López');
    expect(text).toContain('555-0100');
    expect(text).toContain('ana@example.com');
    expect(text).toContain('Av. Principal 123');
    expect(text).toContain('Cliente frecuente');
    expect(text).toContain('Activo');
  });

  it('reads supported filters from router query parameters', () => {
    queryParamMap.next(
      convertToParamMap({ page: '2', limit: '50', activo: 'false', q: '  Ana   López  ' }),
    );

    expect(store.loadList).toHaveBeenLastCalledWith({
      page: 2,
      limit: 50,
      activo: false,
      q: 'Ana López',
    });
    expect(fixture.componentInstance.filtersForm.getRawValue()).toEqual({
      q: 'Ana López',
      activo: 'false',
      limit: 50,
    });
  });

  it('keeps page navigation in router query parameters', () => {
    fixture.componentInstance.goToPage(2);

    expect(router.navigate).toHaveBeenCalledWith([], {
      relativeTo: route,
      queryParams: { page: 2 },
      queryParamsHandling: 'merge',
    });
  });

  it('normalizes and debounces searches before updating the URL', async () => {
    vi.useFakeTimers();

    fixture.componentInstance.filtersForm.controls.q.setValue('  Ana   María  ');
    await vi.advanceTimersByTimeAsync(349);
    expect(router.navigate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(router.navigate).toHaveBeenCalledWith([], {
      relativeTo: route,
      queryParams: { q: 'Ana María', page: 1 },
      queryParamsHandling: 'merge',
    });
  });

  it('updates the active filter and resets pagination', () => {
    fixture.componentInstance.filtersForm.controls.activo.setValue('false');

    expect(router.navigate).toHaveBeenCalledWith([], {
      relativeTo: route,
      queryParams: { activo: 'false', page: 1 },
      queryParamsHandling: 'merge',
    });
  });

  it('renders an empty state for an empty page', () => {
    listState.set({
      status: 'empty',
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      filters: { page: 1, limit: 20 },
      error: null,
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No hay clientes registrados');
  });
});
