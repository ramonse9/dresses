import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import type { Branch, BranchResourceState } from './branch.models';
import { BranchesListPageComponent } from './branches-list-page.component';
import { BranchesStore } from './branches.store';

const branch: Branch = {
  id: 'branch-1',
  nombre: 'Centro',
  direccion: 'Av. Principal 123',
  telefono: '555-0100',
  activo: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('BranchesListPageComponent', () => {
  const listState = signal<BranchResourceState<readonly Branch[]>>({
    status: 'loaded',
    data: [branch],
    error: null,
  });
  const store = { listState: listState.asReadonly(), loadList: vi.fn(() => of(undefined)) };
  let fixture: ComponentFixture<BranchesListPageComponent>;

  beforeEach(async () => {
    vi.clearAllMocks();
    listState.set({ status: 'loaded', data: [branch], error: null });
    TestBed.configureTestingModule({
      imports: [BranchesListPageComponent],
      providers: [provideRouter([]), { provide: BranchesStore, useValue: store }],
    });
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(BranchesListPageComponent);
    fixture.detectChanges();
  });

  it('renders branch data and inactive state', () => {
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Centro');
    expect(text).toContain('Av. Principal 123');
    expect(text).toContain('555-0100');
    expect(text).toContain('Inactiva');
  });

  it('renders an empty state', () => {
    listState.set({ status: 'empty', data: [], error: null });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No hay sucursales registradas');
  });

  it('renders an access-lost error without internal tenant data', () => {
    listState.set({
      status: 'error',
      data: [],
      error: { status: 403, message: 'Forbidden' },
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ya no tienes acceso');
    expect(fixture.nativeElement.textContent).toContain('Seleccionar otra empresa');
    expect(fixture.nativeElement.textContent).not.toContain('schemaName');
  });
});
