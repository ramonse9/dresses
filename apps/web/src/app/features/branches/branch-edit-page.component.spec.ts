import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of } from 'rxjs';
import { TenantStore } from '../../core/tenant/tenant.store';
import { BranchEditPageComponent } from './branch-edit-page.component';
import type { Branch, BranchResourceState, UpdateBranchInput } from './branch.models';
import { BranchesStore } from './branches.store';

const branch: Branch = {
  id: 'branch-1',
  nombre: 'Centro',
  direccion: 'Av. Principal 123',
  telefono: null,
  activo: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('BranchEditPageComponent', () => {
  const role = signal<'OWNER' | 'EMPLOYEE'>('OWNER');
  const detailState = signal<BranchResourceState<Branch | null>>({
    status: 'loaded',
    data: branch,
    error: null,
  });
  const store = {
    detailState: detailState.asReadonly(),
    loadDetail: vi.fn(() => of(undefined)),
    update: vi.fn(() => of(branch)),
  };
  const router = { navigate: vi.fn(() => Promise.resolve(true)) };
  let fixture: ComponentFixture<BranchEditPageComponent>;

  beforeEach(async () => {
    vi.clearAllMocks();
    role.set('OWNER');
    detailState.set({ status: 'loaded', data: branch, error: null });
    const paramMap = convertToParamMap({ id: branch.id });
    TestBed.configureTestingModule({
      imports: [BranchEditPageComponent],
      providers: [
        { provide: BranchesStore, useValue: store },
        { provide: TenantStore, useValue: { role: role.asReadonly() } },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap } } },
      ],
    });
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(BranchEditPageComponent);
    fixture.detectChanges();
  });

  it('loads and updates the branch as OWNER', () => {
    const update: UpdateBranchInput = {
      nombre: 'Centro Histórico',
      direccion: null,
      telefono: '555-0101',
    };

    fixture.componentInstance.update(update);

    expect(store.loadDetail).toHaveBeenCalledWith(branch.id);
    expect(store.update).toHaveBeenCalledWith(branch.id, update);
    expect(router.navigate).toHaveBeenCalledWith(['/app/sucursales', branch.id]);
  });

  it('hides and blocks editing for EMPLOYEE', () => {
    role.set('EMPLOYEE');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    fixture.componentInstance.update({ nombre: 'Otro', direccion: null, telefono: null });
    expect(store.update).not.toHaveBeenCalled();
  });
});
