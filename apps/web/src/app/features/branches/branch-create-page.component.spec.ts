import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { TenantStore } from '../../core/tenant/tenant.store';
import { BranchCreatePageComponent } from './branch-create-page.component';
import type { Branch, CreateBranchInput } from './branch.models';
import { BranchesStore } from './branches.store';

const input: CreateBranchInput = {
  nombre: 'Centro',
  direccion: 'Av. Principal 123',
  telefono: null,
};
const branch: Branch = {
  id: 'branch-1',
  ...input,
  activo: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('BranchCreatePageComponent', () => {
  const role = signal<'OWNER' | 'EMPLOYEE'>('OWNER');
  const store = { create: vi.fn() };
  let router: Router;
  let fixture: ComponentFixture<BranchCreatePageComponent>;

  beforeEach(async () => {
    vi.clearAllMocks();
    role.set('OWNER');
    store.create.mockReturnValue(of(branch));
    TestBed.configureTestingModule({
      imports: [BranchCreatePageComponent],
      providers: [
        provideRouter([]),
        { provide: BranchesStore, useValue: store },
        { provide: TenantStore, useValue: { role: role.asReadonly() } },
      ],
    });
    await TestBed.compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(BranchCreatePageComponent);
    fixture.detectChanges();
  });

  it('creates a branch as OWNER and navigates to its detail', () => {
    fixture.componentInstance.create(input);

    expect(store.create).toHaveBeenCalledWith(input);
    expect(router.navigate).toHaveBeenCalledWith(['/app/sucursales', branch.id]);
  });

  it('rejects a duplicate submission while the first request is pending', () => {
    const response = new Subject<Branch>();
    store.create.mockReturnValueOnce(response.asObservable());

    fixture.componentInstance.create(input);
    fixture.componentInstance.create(input);

    expect(store.create).toHaveBeenCalledOnce();
  });

  it.each([
    [403, 'No tienes autorización'],
    [409, 'Ya existe una sucursal con ese nombre'],
  ] as const)('shows a mutation error for HTTP %s', (status, expected) => {
    store.create.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status, statusText: 'Rejected' })),
    );

    fixture.componentInstance.create(input);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(expected);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('hides the form and blocks mutation for EMPLOYEE', () => {
    role.set('EMPLOYEE');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('No tienes autorización');
    fixture.componentInstance.create(input);
    expect(store.create).not.toHaveBeenCalled();
  });
});
