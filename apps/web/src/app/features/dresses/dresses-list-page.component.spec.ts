import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { BranchesStore } from '../branches/branches.store';
import { TenantStore } from '../../core/tenant/tenant.store';
import type { Dress, DressListState } from './dress.models';
import { DressesListPageComponent } from './dresses-list-page.component';
import { DressesStore } from './dresses.store';

const branchId = '11111111-1111-4111-8111-111111111111';
const branch = {
  id: branchId,
  nombre: 'Centro',
  direccion: null,
  telefono: null,
  activo: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const availableDress: Dress = {
  id: '22222222-2222-4222-8222-222222222222',
  sucursalId: branchId,
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
  sucursal: { id: branchId, nombre: branch.nombre, activo: true },
};
const maintenanceDress: Dress = {
  ...availableDress,
  id: '33333333-3333-4333-8333-333333333333',
  codigo: 'NOCHE-002',
  nombre: 'Noche Azul',
  color: 'Azul',
  marca: null,
  deposito: null,
  estadoOperativo: 'MANTENIMIENTO',
  activo: false,
};
const loadedState: DressListState = {
  status: 'loaded',
  data: [availableDress, maintenanceDress],
  pagination: { page: 1, limit: 20, total: 41, totalPages: 3 },
  filters: { page: 1, limit: 20 },
  error: null,
};

describe('DressesListPageComponent', () => {
  const queryParamMap = new BehaviorSubject(convertToParamMap({}));
  const listState = signal<DressListState>(loadedState);
  const dressesStore = {
    listState: listState.asReadonly(),
    loadList: vi.fn(() => of(undefined)),
  };
  const branchesStore = {
    listState: signal({ status: 'loaded', data: [branch], error: null }).asReadonly(),
    loadList: vi.fn(() => of(undefined)),
  };
  const route = {
    queryParamMap: queryParamMap.asObservable(),
    snapshot: { queryParamMap: queryParamMap.value },
  };
  let fixture: ComponentFixture<DressesListPageComponent>;
  let router: Router;

  beforeEach(async () => {
    vi.clearAllMocks();
    queryParamMap.next(convertToParamMap({}));
    listState.set(loadedState);
    route.snapshot.queryParamMap = queryParamMap.value;
    TestBed.configureTestingModule({
      imports: [DressesListPageComponent],
      providers: [
        provideRouter([]),
        { provide: DressesStore, useValue: dressesStore },
        { provide: BranchesStore, useValue: branchesStore },
        { provide: TenantStore, useValue: { role: signal('OWNER') } },
        { provide: ActivatedRoute, useValue: route },
      ],
    });
    await TestBed.compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(DressesListPageComponent);
    fixture.detectChanges();
  });

  afterEach(() => vi.useRealTimers());

  it('renders catalog data, money and differentiated states', () => {
    const text = fixture.nativeElement.textContent;

    expect(dressesStore.loadList).toHaveBeenCalledWith({ page: 1, limit: 20 });
    expect(text).toContain('GALA-001');
    expect(text).toContain('Gala Roja');
    expect(text).toContain('Centro');
    expect(text).toContain('Talla');
    expect(text).toContain('Rojo');
    expect(text).toContain('Atelier');
    expect(text).toContain('$1,250.50');
    expect(text).toContain('$500.00');
    expect(text).toContain('Operativamente disponible');
    expect(text).toContain('En mantenimiento');
    expect(text).toContain('Inactivo');
    expect(text).toContain('No requerido');
    expect(text).toContain('no garantiza que esté libre');
    expect(text).toContain('Nuevo vestido');
  });

  it('reads every supported filter from query parameters', () => {
    queryParamMap.next(
      convertToParamMap({
        page: '2',
        limit: '50',
        sucursalId: branchId,
        activo: 'false',
        estadoOperativo: 'MANTENIMIENTO',
        q: 'Noche',
      }),
    );

    expect(dressesStore.loadList).toHaveBeenLastCalledWith({
      page: 2,
      limit: 50,
      sucursalId: branchId,
      activo: false,
      estadoOperativo: 'MANTENIMIENTO',
      q: 'Noche',
    });
  });

  it('writes branch and operational filters to the router', () => {
    fixture.componentInstance.filtersForm.controls.sucursalId.setValue(branchId);
    fixture.componentInstance.filtersForm.controls.estadoOperativo.setValue('DISPONIBLE');

    expect(router.navigate).toHaveBeenNthCalledWith(1, [], {
      relativeTo: route,
      queryParams: { sucursalId: branchId, page: 1 },
      queryParamsHandling: 'merge',
    });
    expect(router.navigate).toHaveBeenNthCalledWith(2, [], {
      relativeTo: route,
      queryParams: { estadoOperativo: 'DISPONIBLE', page: 1 },
      queryParamsHandling: 'merge',
    });
  });

  it('normalizes and debounces catalog search', async () => {
    vi.useFakeTimers();
    fixture.componentInstance.filtersForm.controls.q.setValue('  Gala   Roja  ');

    await vi.advanceTimersByTimeAsync(350);

    expect(router.navigate).toHaveBeenCalledWith([], {
      relativeTo: route,
      queryParams: { q: 'Gala Roja', page: 1 },
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

  it('renders an empty catalog state', () => {
    listState.set({
      status: 'empty',
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      filters: { page: 1, limit: 20 },
      error: null,
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No hay vestidos registrados');
  });
});
