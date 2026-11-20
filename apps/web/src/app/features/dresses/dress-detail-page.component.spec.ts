import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { TenantStore } from '../../core/tenant/tenant.store';
import type { Dress, DressDetailState } from './dress.models';
import { DressDetailPageComponent } from './dress-detail-page.component';
import { DressesStore } from './dresses.store';

const dress: Dress = {
  id: '22222222-2222-4222-8222-222222222222',
  sucursalId: '11111111-1111-4111-8111-111111111111',
  codigo: 'GALA-001',
  nombre: 'Gala Roja',
  descripcion: 'Vestido largo con aplicaciones',
  talla: 'M',
  color: 'Rojo',
  marca: 'Atelier',
  precioRenta: '1250.50',
  deposito: '500.00',
  estadoOperativo: 'MANTENIMIENTO',
  activo: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  sucursal: {
    id: '11111111-1111-4111-8111-111111111111',
    nombre: 'Centro',
    activo: true,
  },
};

describe('DressDetailPageComponent', () => {
  const role = signal<'OWNER' | 'EMPLOYEE'>('OWNER');
  const detailState = signal<DressDetailState>({ status: 'loaded', data: dress, error: null });
  const store = {
    detailState: detailState.asReadonly(),
    loadDetail: vi.fn(() => of(undefined)),
    deactivate: vi.fn(() => of({ ...dress, sucursal: undefined })),
    reactivate: vi.fn(() => of({ ...dress, sucursal: undefined, activo: true })),
  };
  let fixture: ComponentFixture<DressDetailPageComponent>;

  beforeEach(async () => {
    vi.clearAllMocks();
    role.set('OWNER');
    detailState.set({ status: 'loaded', data: dress, error: null });
    const paramMap = convertToParamMap({ id: dress.id });
    const queryParamMap = convertToParamMap({ page: '2', estadoOperativo: 'MANTENIMIENTO' });
    TestBed.configureTestingModule({
      imports: [DressDetailPageComponent],
      providers: [
        provideRouter([]),
        { provide: DressesStore, useValue: store },
        { provide: TenantStore, useValue: { role: role.asReadonly() } },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(paramMap), snapshot: { paramMap, queryParamMap } },
        },
      ],
    });
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(DressDetailPageComponent);
    fixture.detectChanges();
  });

  it('renders complete detail, exact money and states', () => {
    const text = fixture.nativeElement.textContent;

    expect(store.loadDetail).toHaveBeenCalledWith(dress.id);
    expect(text).toContain('GALA-001');
    expect(text).toContain('Gala Roja');
    expect(text).toContain('Centro');
    expect(text).toContain('M');
    expect(text).toContain('Rojo');
    expect(text).toContain('Atelier');
    expect(text).toContain('$1,250.50');
    expect(text).toContain('$500.00');
    expect(text).toContain('En mantenimiento');
    expect(text).toContain('Inactivo');
    expect(text).toContain('no confirma que la pieza esté libre');
  });

  it('renders a tenant-safe not-found state', () => {
    detailState.set({
      status: 'error',
      data: null,
      error: { status: 404, message: 'Vestido no encontrado' },
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('no existe o no está disponible');
    expect(fixture.nativeElement.textContent).not.toContain('schemaName');
  });

  it('preserves catalog filters in the back link', () => {
    const backLink = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;

    expect(backLink.search).toBe('?page=2&limit=20&estadoOperativo=MANTENIMIENTO');
  });

  it('requires confirmation before logical deactivation', () => {
    detailState.set({ status: 'loaded', data: { ...dress, activo: true }, error: null });
    fixture.detectChanges();
    fixture.componentInstance.requestDeactivate();
    expect(store.deactivate).not.toHaveBeenCalled();
    expect(fixture.componentInstance.confirmationOpen()).toBe(true);
    fixture.componentInstance.confirmDeactivate();
    expect(store.deactivate).toHaveBeenCalledWith(dress.id);
  });

  it('hides every mutation control from EMPLOYEE', () => {
    role.set('EMPLOYEE');
    detailState.set({ status: 'loaded', data: { ...dress, activo: true }, error: null });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Editar vestido');
    expect(fixture.nativeElement.textContent).not.toContain('Desactivar');
    fixture.componentInstance.requestDeactivate();
    expect(fixture.componentInstance.confirmationOpen()).toBe(false);
  });

  it('reactivates an inactive dress through the dedicated action', () => {
    fixture.componentInstance.reactivate();
    expect(store.reactivate).toHaveBeenCalledWith(dress.id);
  });
});
