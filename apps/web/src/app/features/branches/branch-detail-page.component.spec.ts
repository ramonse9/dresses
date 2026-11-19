import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import type { Branch, BranchResourceState } from './branch.models';
import { BranchDetailPageComponent } from './branch-detail-page.component';
import { BranchesStore } from './branches.store';

const branch: Branch = {
  id: 'branch-1',
  nombre: 'Centro',
  direccion: null,
  telefono: null,
  activo: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('BranchDetailPageComponent', () => {
  const detailState = signal<BranchResourceState<Branch | null>>({
    status: 'loaded',
    data: branch,
    error: null,
  });
  const store = { detailState: detailState.asReadonly(), loadDetail: vi.fn(() => of(undefined)) };
  let fixture: ComponentFixture<BranchDetailPageComponent>;

  beforeEach(async () => {
    vi.clearAllMocks();
    detailState.set({ status: 'loaded', data: branch, error: null });
    const paramMap = convertToParamMap({ id: branch.id });
    TestBed.configureTestingModule({
      imports: [BranchDetailPageComponent],
      providers: [
        provideRouter([]),
        { provide: BranchesStore, useValue: store },
        { provide: ActivatedRoute, useValue: { paramMap: of(paramMap), snapshot: { paramMap } } },
      ],
    });
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(BranchDetailPageComponent);
    fixture.detectChanges();
  });

  it('loads and renders the requested branch', () => {
    expect(store.loadDetail).toHaveBeenCalledWith(branch.id);
    expect(fixture.nativeElement.textContent).toContain('Centro');
    expect(fixture.nativeElement.textContent).toContain('Activa');
    expect(fixture.nativeElement.textContent).toContain('No registrada');
    expect(fixture.nativeElement.textContent).toContain('No registrado');
  });

  it('renders a tenant-safe not-found state', () => {
    detailState.set({
      status: 'error',
      data: null,
      error: { status: 404, message: 'Sucursal no encontrada' },
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('no existe o no está disponible');
    expect(fixture.nativeElement.textContent).not.toContain('schemaName');
  });
});
