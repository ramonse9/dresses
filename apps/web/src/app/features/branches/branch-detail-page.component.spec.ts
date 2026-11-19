import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { TenantStore } from '../../core/tenant/tenant.store';
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
  const role = signal<'OWNER' | 'EMPLOYEE'>('OWNER');
  const detailState = signal<BranchResourceState<Branch | null>>({
    status: 'loaded',
    data: branch,
    error: null,
  });
  const store = {
    detailState: detailState.asReadonly(),
    loadDetail: vi.fn(() => of(undefined)),
    deactivate: vi.fn(() => of({ ...branch, activo: false })),
    reactivate: vi.fn(() => of({ ...branch, activo: true })),
  };
  let fixture: ComponentFixture<BranchDetailPageComponent>;

  beforeEach(async () => {
    vi.clearAllMocks();
    role.set('OWNER');
    detailState.set({ status: 'loaded', data: branch, error: null });
    const paramMap = convertToParamMap({ id: branch.id });
    TestBed.configureTestingModule({
      imports: [BranchDetailPageComponent],
      providers: [
        provideRouter([]),
        { provide: BranchesStore, useValue: store },
        { provide: TenantStore, useValue: { role: role.asReadonly() } },
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

  it('requires confirmation before logical deactivation', () => {
    const deactivateButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.trim() === 'Desactivar') as HTMLButtonElement;

    deactivateButton.click();
    fixture.detectChanges();

    expect(store.deactivate).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('La sucursal no se eliminará físicamente');
    const confirmButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.trim() === 'Confirmar baja lógica') as HTMLButtonElement;
    confirmButton.click();
    expect(store.deactivate).toHaveBeenCalledWith(branch.id);
  });

  it('reactivates an inactive branch', () => {
    detailState.set({ status: 'loaded', data: { ...branch, activo: false }, error: null });
    fixture.detectChanges();
    const reactivateButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.trim() === 'Reactivar') as HTMLButtonElement;

    reactivateButton.click();

    expect(store.reactivate).toHaveBeenCalledWith(branch.id);
  });

  it('hides all mutation actions from EMPLOYEE', () => {
    role.set('EMPLOYEE');
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;

    expect(text).not.toContain('Editar');
    expect(text).not.toContain('Desactivar');
    expect(text).not.toContain('Reactivar');
  });
});
