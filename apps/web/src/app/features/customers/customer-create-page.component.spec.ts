import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { TenantStore } from '../../core/tenant/tenant.store';
import { CustomerCreatePageComponent } from './customer-create-page.component';
import type { CreateCustomerInput, Customer } from './customer.models';
import { CustomersStore } from './customers.store';

const input: CreateCustomerInput = {
  nombre: 'Ana López',
  telefono: null,
  email: 'ana@example.com',
  direccion: null,
  notas: null,
};
const customer: Customer = {
  id: '11111111-1111-4111-8111-111111111111',
  ...input,
  activo: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('CustomerCreatePageComponent', () => {
  const role = signal<'OWNER' | 'EMPLOYEE'>('OWNER');
  const store = { create: vi.fn(() => of(customer)) };
  let fixture: ComponentFixture<CustomerCreatePageComponent>;
  let router: Router;

  beforeEach(async () => {
    vi.clearAllMocks();
    role.set('OWNER');
    const queryParamMap = convertToParamMap({ page: '3', limit: '50', q: 'ana' });
    TestBed.configureTestingModule({
      imports: [CustomerCreatePageComponent],
      providers: [
        provideRouter([]),
        { provide: CustomersStore, useValue: store },
        { provide: TenantStore, useValue: { role: role.asReadonly() } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap } } },
      ],
    });
    await TestBed.compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(CustomerCreatePageComponent);
    fixture.detectChanges();
  });

  it.each(['OWNER', 'EMPLOYEE'] as const)('creates a customer as %s', (currentRole) => {
    role.set(currentRole);
    fixture.componentInstance.create(input);

    expect(store.create).toHaveBeenCalledWith(input);
    expect(router.navigate).toHaveBeenCalledWith(['/app/clientes', customer.id], {
      queryParams: { page: 3, limit: 50, q: 'ana' },
    });
  });

  it('renders the reusable form for both allowed roles', () => {
    expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
    role.set('EMPLOYEE');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
  });
});
