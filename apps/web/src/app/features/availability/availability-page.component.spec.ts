import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { BranchesStore } from '../branches/branches.store';
import type { Dress } from '../dresses/dress.models';
import { AvailabilityPageComponent } from './availability-page.component';
import type { AvailabilityState } from './availability.models';
import { AvailabilityStore } from './availability.store';

const branchId = '11111111-1111-4111-8111-111111111111';
const branch = {
  id: branchId,
  nombre: 'Centro',
  direccion: null,
  telefono: null,
  activo: true,
  createdAt: '',
  updatedAt: '',
};
const maintenanceDress: Dress = {
  id: 'dress-1',
  sucursalId: branchId,
  codigo: 'GALA-1',
  nombre: 'Gala',
  descripcion: null,
  talla: 'M',
  color: 'Rojo',
  marca: null,
  precioRenta: '100.00',
  deposito: '25.00',
  estadoOperativo: 'MANTENIMIENTO',
  activo: true,
  createdAt: '',
  updatedAt: '',
  sucursal: { id: branchId, nombre: branch.nombre, activo: true },
};
const initialState: AvailabilityState = {
  status: 'idle',
  data: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  range: null,
  filters: null,
  error: null,
};

describe('AvailabilityPageComponent', () => {
  const queryParamMap = new BehaviorSubject(convertToParamMap({}));
  const state = signal<AvailabilityState>(initialState);
  const store = { state: state.asReadonly(), search: vi.fn(() => of(undefined)), clear: vi.fn() };
  const branchesStore = {
    listState: signal({ status: 'loaded', data: [branch], error: null }).asReadonly(),
    loadList: vi.fn(() => of(undefined)),
  };
  const route = { queryParamMap: queryParamMap.asObservable() };
  let fixture: ComponentFixture<AvailabilityPageComponent>;
  let router: Router;

  beforeEach(async () => {
    vi.clearAllMocks();
    state.set(initialState);
    queryParamMap.next(convertToParamMap({}));
    await TestBed.configureTestingModule({
      imports: [AvailabilityPageComponent],
      providers: [
        provideRouter([]),
        { provide: AvailabilityStore, useValue: store },
        { provide: BranchesStore, useValue: branchesStore },
        { provide: ActivatedRoute, useValue: route },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(AvailabilityPageComponent);
    fixture.detectChanges();
  });

  it('serializes a valid range with timezone and supported filters', () => {
    fixture.componentInstance.form.setValue({
      sucursalId: branchId,
      fechaInicio: '2026-12-10T16:00',
      fechaFin: '2026-12-12T16:00',
      talla: ' M ',
      color: ' Rojo ',
      estadoOperativo: 'DISPONIBLE',
      limit: 20,
    });
    fixture.componentInstance.submit();

    const params = vi.mocked(router.navigate).mock.calls[0][1]?.queryParams as Record<
      string,
      unknown
    >;
    expect(params['fechaInicio']).toMatch(/Z$/);
    expect(params['fechaFin']).toMatch(/Z$/);
    expect(params).toMatchObject({
      sucursalId: branchId,
      talla: 'M',
      color: 'Rojo',
      page: 1,
      limit: 20,
    });
    expect(JSON.stringify(params)).not.toMatch(/empresaId|empresaSlug|schemaName/);
  });

  it('rejects an inverted range without navigation', () => {
    fixture.componentInstance.form.patchValue({
      sucursalId: branchId,
      fechaInicio: '2026-12-12T16:00',
      fechaFin: '2026-12-10T16:00',
    });
    fixture.componentInstance.submit();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(fixture.componentInstance.localValidationError()).toContain('posterior');
  });

  it('loads filters and pagination from query parameters', () => {
    queryParamMap.next(
      convertToParamMap({
        sucursalId: branchId,
        fechaInicio: '2026-12-10T23:00:00.000Z',
        fechaFin: '2026-12-12T23:00:00.000Z',
        talla: 'M',
        color: 'Rojo',
        estadoOperativo: 'MANTENIMIENTO',
        page: '2',
        limit: '50',
      }),
    );
    expect(store.search).toHaveBeenCalledWith(
      expect.objectContaining({ estadoOperativo: 'MANTENIMIENTO', page: 2, limit: 50 }),
    );
  });

  it('keeps pagination in the availability URL', () => {
    state.set({
      ...initialState,
      status: 'loaded',
      pagination: { page: 1, limit: 20, total: 25, totalPages: 2 },
      filters: {
        sucursalId: branchId,
        fechaInicio: '2026-12-10T23:00:00.000Z',
        fechaFin: '2026-12-12T23:00:00.000Z',
        estadoOperativo: 'DISPONIBLE',
        page: 1,
        limit: 20,
      },
    });
    fixture.componentInstance.goToPage(2);

    expect(router.navigate).toHaveBeenCalledWith([], {
      relativeTo: route,
      queryParams: expect.objectContaining({ page: 2, limit: 20 }),
    });
  });

  it('marks maintenance results as not rentable', () => {
    state.set({
      status: 'loaded',
      data: [maintenanceDress],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      range: { fechaInicio: '2026-12-10T23:00:00.000Z', fechaFin: '2026-12-12T23:00:00.000Z' },
      filters: {
        sucursalId: branchId,
        fechaInicio: '2026-12-10T23:00:00.000Z',
        fechaFin: '2026-12-12T23:00:00.000Z',
        estadoOperativo: 'MANTENIMIENTO',
        page: 1,
        limit: 20,
      },
      error: null,
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No rentable · mantenimiento');
    expect(fixture.nativeElement.textContent).toContain('$100.00');
  });

  it('renders empty and tenant-safe branch 404 states', () => {
    state.set({ ...initialState, status: 'empty', filters: null });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No hay piezas libres');

    state.set({
      ...initialState,
      status: 'error',
      error: { status: 404, message: 'No encontrada' },
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('no existe, está inactiva');
    expect(fixture.nativeElement.textContent).not.toContain('schemaName');
  });
});
