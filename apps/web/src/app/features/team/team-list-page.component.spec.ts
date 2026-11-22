import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import type { TeamListState, TeamMember } from './team.models';
import { TeamListPageComponent } from './team-list-page.component';
import { TeamStore } from './team.store';
import { TenantStore } from '../../core/tenant/tenant.store';

const member: TeamMember = {
  id: '11111111-1111-4111-8111-111111111111',
  usuario: {
    id: '22222222-2222-4222-8222-222222222222',
    nombre: 'Ana López',
    email: 'ana@example.test',
    activo: true,
  },
  rol: 'OWNER',
  activo: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};
const loadedState: TeamListState = {
  status: 'loaded',
  data: [member],
  pagination: { page: 1, limit: 20, total: 41, totalPages: 3 },
  filters: { page: 1, limit: 20 },
  error: null,
};

describe('TeamListPageComponent', () => {
  const queryParamMap = new BehaviorSubject(convertToParamMap({}));
  const listState = signal<TeamListState>(loadedState);
  const store = { listState: listState.asReadonly(), loadList: vi.fn(() => of(undefined)) };
  const route = {
    queryParamMap: queryParamMap.asObservable(),
    snapshot: { queryParamMap: queryParamMap.value },
  };
  let fixture: ComponentFixture<TeamListPageComponent>;
  let router: Router;

  beforeEach(async () => {
    vi.clearAllMocks();
    queryParamMap.next(convertToParamMap({}));
    listState.set(loadedState);
    route.snapshot.queryParamMap = queryParamMap.value;
    TestBed.configureTestingModule({
      imports: [TeamListPageComponent],
      providers: [
        provideRouter([]),
        { provide: TeamStore, useValue: store },
        { provide: TenantStore, useValue: { role: signal('OWNER') } },
        { provide: ActivatedRoute, useValue: route },
      ],
    });
    await TestBed.compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(TeamListPageComponent);
    fixture.detectChanges();
  });

  afterEach(() => vi.useRealTimers());

  it('renders member, role, membership and global user status', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Ana López');
    expect(text).toContain('ana@example.test');
    expect(text).toContain('Propietario');
    expect(text).toContain('Membresía');
    expect(text).toContain('Usuario global');
    expect(JSON.stringify(listState())).not.toContain('schemaName');
  });

  it('reads all supported filters from query parameters', () => {
    queryParamMap.next(
      convertToParamMap({
        page: '2',
        limit: '50',
        rol: 'EMPLOYEE',
        activo: 'false',
        q: '  Ana  ',
      }),
    );
    expect(store.loadList).toHaveBeenLastCalledWith({
      page: 2,
      limit: 50,
      rol: 'EMPLOYEE',
      activo: false,
      q: 'Ana',
    });
  });

  it('debounces search and keeps pagination in the URL', async () => {
    vi.useFakeTimers();
    fixture.componentInstance.filtersForm.controls.q.setValue('  Bea   Ruiz ');
    await vi.advanceTimersByTimeAsync(350);
    expect(router.navigate).toHaveBeenCalledWith([], {
      relativeTo: route,
      queryParams: { q: 'Bea Ruiz', page: 1 },
      queryParamsHandling: 'merge',
    });

    fixture.componentInstance.goToPage(2);
    expect(router.navigate).toHaveBeenLastCalledWith([], {
      relativeTo: route,
      queryParams: { page: 2 },
      queryParamsHandling: 'merge',
    });
  });

  it('renders authorization errors distinctly', () => {
    listState.set({
      ...loadedState,
      status: 'error',
      data: [],
      error: { status: 403, message: '' },
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No tienes autorización');
    expect(fixture.nativeElement.textContent).not.toContain('no existe');
  });
});
