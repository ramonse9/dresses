import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import type { AuditEvent, AuditListState } from './audit.models';
import { AuditListPageComponent } from './audit-list-page.component';
import { AuditStore } from './audit.store';

const event: AuditEvent = {
  id: '11111111-1111-4111-8111-111111111111',
  action: 'reservation.updated',
  resourceType: 'reservacion',
  resourceId: '22222222-2222-4222-8222-222222222222',
  actor: {
    id: '33333333-3333-4333-8333-333333333333',
    nombre: 'Owner Principal',
    email: 'owner@example.test',
    activo: true,
  },
  metadata: { previousState: 'BORRADOR', newState: 'CONFIRMADA' },
  ipAddress: null,
  userAgent: null,
  createdAt: '2026-11-24T15:00:00.000Z',
};
const loadedState: AuditListState = {
  status: 'loaded',
  data: [event],
  pagination: { page: 1, limit: 20, total: 41, totalPages: 3 },
  filters: { page: 1, limit: 20 },
  error: null,
};

describe('AuditListPageComponent', () => {
  const queryParamMap = new BehaviorSubject(convertToParamMap({}));
  const listState = signal<AuditListState>(loadedState);
  const store = { listState: listState.asReadonly(), loadList: vi.fn(() => of(undefined)) };
  const route = {
    queryParamMap: queryParamMap.asObservable(),
    snapshot: { queryParamMap: queryParamMap.value },
  };
  let fixture: ComponentFixture<AuditListPageComponent>;
  let router: Router;

  beforeEach(async () => {
    vi.clearAllMocks();
    queryParamMap.next(convertToParamMap({}));
    listState.set(loadedState);
    route.snapshot.queryParamMap = queryParamMap.value;
    TestBed.configureTestingModule({
      imports: [AuditListPageComponent],
      providers: [
        provideRouter([]),
        { provide: AuditStore, useValue: store },
        { provide: ActivatedRoute, useValue: route },
      ],
    });
    await TestBed.compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(AuditListPageComponent);
    fixture.detectChanges();
  });

  it('renders accessible event summary without raw metadata', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Auditoría');
    expect(text).toContain('Reservación actualizada');
    expect(text).toContain('Owner Principal');
    expect(text).toContain('BORRADOR → CONFIRMADA');
    expect(
      fixture.nativeElement.querySelector('form[aria-label="Filtros de auditoría"]'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('nav[aria-label="Paginación de auditoría"]'),
    ).not.toBeNull();
    expect(text).not.toMatch(/schemaName|tokenHash|password|authorization|tenant_/i);
  });

  it('loads all supported filters from query parameters', () => {
    queryParamMap.next(
      convertToParamMap({
        page: '2',
        limit: '50',
        action: 'reservation.updated',
        resourceType: 'reservacion',
        resourceId: event.resourceId,
        actor: event.actor?.id,
        fechaDesde: '2026-11-20T00:00:00.000Z',
        fechaHasta: '2026-11-25T00:00:00.000Z',
      }),
    );
    expect(store.loadList).toHaveBeenLastCalledWith({
      page: 2,
      limit: 50,
      action: 'reservation.updated',
      resourceType: 'reservacion',
      resourceId: event.resourceId,
      actor: event.actor?.id,
      fechaDesde: '2026-11-20T00:00:00.000Z',
      fechaHasta: '2026-11-25T00:00:00.000Z',
    });
  });

  it('writes filters and pagination to query parameters', () => {
    fixture.componentInstance.filtersForm.patchValue({
      action: 'reservation.updated',
      resourceType: 'reservacion',
      resourceId: event.resourceId ?? '',
      actor: event.actor?.id ?? '',
      fechaDesde: '2026-11-20T08:00',
      fechaHasta: '2026-11-21T08:00',
      limit: 50,
    });
    fixture.componentInstance.applyFilters();
    expect(router.navigate).toHaveBeenCalledWith([], {
      relativeTo: route,
      queryParams: expect.objectContaining({
        action: 'reservation.updated',
        resourceType: 'reservacion',
        resourceId: event.resourceId,
        actor: event.actor?.id,
        fechaDesde: expect.stringMatching(/Z$/),
        fechaHasta: expect.stringMatching(/Z$/),
        limit: 50,
        page: 1,
      }),
      queryParamsHandling: 'merge',
    });

    fixture.componentInstance.goToPage(2);
    expect(router.navigate).toHaveBeenLastCalledWith([], {
      relativeTo: route,
      queryParams: { page: 2 },
      queryParamsHandling: 'merge',
    });
  });

  it('shows a permission error distinctly from missing resources', () => {
    listState.set({
      ...loadedState,
      status: 'error',
      data: [],
      error: { status: 403, message: 'Forbidden' },
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No tienes autorización');
    expect(fixture.nativeElement.textContent).not.toContain('no existe');
  });
});
