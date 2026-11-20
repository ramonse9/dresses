import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { BranchesStore } from '../branches/branches.store';
import { TenantStore } from '../../core/tenant/tenant.store';
import { DressCreatePageComponent } from './dress-create-page.component';
import type { DressFormValue, DressMutationResult } from './dress.models';
import { DressesStore } from './dresses.store';

const role = signal<'OWNER' | 'EMPLOYEE'>('OWNER');
const branch = {
  id: 'branch-1',
  nombre: 'Centro',
  direccion: null,
  telefono: null,
  activo: true,
  createdAt: '',
  updatedAt: '',
};
const value: DressFormValue = {
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
};

describe('DressCreatePageComponent', () => {
  const result = new Subject<DressMutationResult>();
  const store = { create: vi.fn(() => result.asObservable()) };
  const branchesStore = {
    listState: signal({ status: 'loaded', data: [branch], error: null }).asReadonly(),
    loadList: vi.fn(),
  };
  let fixture: ComponentFixture<DressCreatePageComponent>;
  let router: Router;

  beforeEach(async () => {
    role.set('OWNER');
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [DressCreatePageComponent],
      providers: [
        provideRouter([]),
        { provide: DressesStore, useValue: store },
        { provide: BranchesStore, useValue: branchesStore },
        { provide: TenantStore, useValue: { role: role.asReadonly() } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
        },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(DressCreatePageComponent);
    fixture.detectChanges();
  });

  it('creates without sending activo and prevents a duplicate request', () => {
    fixture.componentInstance.create(value);
    fixture.componentInstance.create(value);
    expect(store.create).toHaveBeenCalledTimes(1);
    expect(store.create).toHaveBeenCalledWith(
      expect.not.objectContaining({ activo: expect.anything() }),
    );
  });

  it('does not allow EMPLOYEE to invoke creation', () => {
    role.set('EMPLOYEE');
    fixture.detectChanges();
    fixture.componentInstance.create(value);
    expect(store.create).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('No tienes autorización');
  });
});
