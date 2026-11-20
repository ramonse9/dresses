import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { BranchesStore } from '../branches/branches.store';
import { TenantStore } from '../../core/tenant/tenant.store';
import { DressEditPageComponent } from './dress-edit-page.component';
import type { Dress, DressFormValue } from './dress.models';
import { DressesStore } from './dresses.store';

const branch = {
  id: 'branch-1',
  nombre: 'Centro',
  direccion: null,
  telefono: null,
  activo: true,
  createdAt: '',
  updatedAt: '',
};
const destination = { ...branch, id: 'branch-2', nombre: 'Norte' };
const dress: Dress = {
  id: 'dress-1',
  sucursalId: branch.id,
  codigo: 'GALA-1',
  nombre: 'Gala',
  descripcion: null,
  talla: 'M',
  color: 'Rojo',
  marca: null,
  precioRenta: '100.00',
  deposito: null,
  estadoOperativo: 'DISPONIBLE',
  activo: true,
  createdAt: '',
  updatedAt: '',
  sucursal: { id: branch.id, nombre: branch.nombre, activo: true },
};

describe('DressEditPageComponent', () => {
  const detailState = signal({ status: 'loaded' as const, data: dress, error: null });
  const store = {
    detailState: detailState.asReadonly(),
    loadDetail: vi.fn(() => of(undefined)),
    update: vi.fn(() => of({ ...dress, sucursal: undefined })),
  };
  let fixture: ComponentFixture<DressEditPageComponent>;

  beforeEach(async () => {
    vi.clearAllMocks();
    detailState.set({ status: 'loaded', data: dress, error: null });
    const paramMap = convertToParamMap({ id: dress.id });
    await TestBed.configureTestingModule({
      imports: [DressEditPageComponent],
      providers: [
        provideRouter([]),
        { provide: DressesStore, useValue: store },
        {
          provide: BranchesStore,
          useValue: {
            listState: signal({
              status: 'loaded',
              data: [branch, destination],
              error: null,
            }).asReadonly(),
            loadList: vi.fn(),
          },
        },
        { provide: TenantStore, useValue: { role: signal('OWNER') } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap, queryParamMap: convertToParamMap({}) } },
        },
      ],
    }).compileComponents();
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(DressEditPageComponent);
    fixture.detectChanges();
  });

  it('requires explicit confirmation before transferring', () => {
    const transfer: DressFormValue = { ...dress, sucursalId: destination.id };
    fixture.componentInstance.requestUpdate(transfer);
    expect(store.update).not.toHaveBeenCalled();
    expect(fixture.componentInstance.pendingUpdate()).toEqual(transfer);
    fixture.componentInstance.confirmTransfer();
    expect(store.update).toHaveBeenCalledWith(dress.id, transfer);
  });

  it('cancels a pending transfer without mutation', () => {
    fixture.componentInstance.requestUpdate({ ...dress, sucursalId: destination.id });
    fixture.componentInstance.cancelTransfer();
    expect(store.update).not.toHaveBeenCalled();
    expect(fixture.componentInstance.pendingUpdate()).toBeNull();
  });
});
