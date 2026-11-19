import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import type { Customer, CustomerDetailState } from './customer.models';
import { CustomerDetailPageComponent } from './customer-detail-page.component';
import { CustomersStore } from './customers.store';

const customer: Customer = {
  id: '11111111-1111-4111-8111-111111111111',
  nombre: 'Ana López',
  telefono: '555-0100',
  email: 'ana@example.com',
  direccion: 'Av. Principal 123',
  notas: 'Cliente frecuente',
  activo: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('CustomerDetailPageComponent', () => {
  const detailState = signal<CustomerDetailState>({
    status: 'loaded',
    data: customer,
    error: null,
  });
  const store = {
    detailState: detailState.asReadonly(),
    loadDetail: vi.fn(() => of(undefined)),
  };
  let fixture: ComponentFixture<CustomerDetailPageComponent>;

  beforeEach(async () => {
    vi.clearAllMocks();
    detailState.set({ status: 'loaded', data: customer, error: null });
    const paramMap = convertToParamMap({ id: customer.id });
    TestBed.configureTestingModule({
      imports: [CustomerDetailPageComponent],
      providers: [
        provideRouter([]),
        { provide: CustomersStore, useValue: store },
        { provide: ActivatedRoute, useValue: { paramMap: of(paramMap), snapshot: { paramMap } } },
      ],
    });
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(CustomerDetailPageComponent);
    fixture.detectChanges();
  });

  it('loads and renders the requested customer', () => {
    expect(store.loadDetail).toHaveBeenCalledWith(customer.id);
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Ana López');
    expect(text).toContain('555-0100');
    expect(text).toContain('ana@example.com');
    expect(text).toContain('Av. Principal 123');
    expect(text).toContain('Cliente frecuente');
    expect(text).toContain('Inactivo');
  });

  it('renders a tenant-safe not-found state', () => {
    detailState.set({
      status: 'error',
      data: null,
      error: { status: 404, message: 'Cliente no encontrado' },
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('no existe o no está disponible');
    expect(fixture.nativeElement.textContent).not.toContain('schemaName');
  });
});
