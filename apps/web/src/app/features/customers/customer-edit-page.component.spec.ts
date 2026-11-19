import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { TenantStore } from '../../core/tenant/tenant.store';
import { CustomerEditPageComponent } from './customer-edit-page.component';
import type { Customer, CustomerDetailState, UpdateCustomerInput } from './customer.models';
import { CustomersStore } from './customers.store';

const customer: Customer = {
  id: '11111111-1111-4111-8111-111111111111',
  nombre: 'Ana López',
  telefono: null,
  email: 'ana@example.com',
  direccion: null,
  notas: null,
  activo: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('CustomerEditPageComponent', () => {
  const role = signal<'OWNER' | 'EMPLOYEE'>('OWNER');
  const detailState = signal<CustomerDetailState>({
    status: 'loaded',
    data: customer,
    error: null,
  });
  const store = {
    detailState: detailState.asReadonly(),
    loadDetail: vi.fn(() => of(undefined)),
    update: vi.fn(() => of(customer)),
  };
  let fixture: ComponentFixture<CustomerEditPageComponent>;
  let router: Router;

  beforeEach(async () => {
    vi.clearAllMocks();
    role.set('OWNER');
    detailState.set({ status: 'loaded', data: customer, error: null });
    const paramMap = convertToParamMap({ id: customer.id });
    const queryParamMap = convertToParamMap({ page: '2', activo: 'true' });
    TestBed.configureTestingModule({
      imports: [CustomerEditPageComponent],
      providers: [
        provideRouter([]),
        { provide: CustomersStore, useValue: store },
        { provide: TenantStore, useValue: { role: role.asReadonly() } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap, queryParamMap } } },
      ],
    });
    await TestBed.compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(CustomerEditPageComponent);
    fixture.detectChanges();
  });

  it.each(['OWNER', 'EMPLOYEE'] as const)('updates a customer as %s', (currentRole) => {
    role.set(currentRole);
    const update: UpdateCustomerInput = {
      nombre: 'Ana María',
      telefono: '555-0100',
      email: null,
      direccion: null,
      notas: null,
    };

    fixture.componentInstance.update(update);

    expect(store.loadDetail).toHaveBeenCalledWith(customer.id);
    expect(store.update).toHaveBeenCalledWith(customer.id, update);
    expect(router.navigate).toHaveBeenCalledWith(['/app/clientes', customer.id], {
      queryParams: { page: 2, limit: 20, activo: 'true' },
    });
  });
});
