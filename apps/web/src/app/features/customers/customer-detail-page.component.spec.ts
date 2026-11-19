import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { TenantStore } from '../../core/tenant/tenant.store';
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
  const role = signal<'OWNER' | 'EMPLOYEE'>('OWNER');
  const detailState = signal<CustomerDetailState>({
    status: 'loaded',
    data: customer,
    error: null,
  });
  const store = {
    detailState: detailState.asReadonly(),
    loadDetail: vi.fn(() => of(undefined)),
    deactivate: vi.fn(() => of({ ...customer, activo: false })),
    reactivate: vi.fn(() => of({ ...customer, activo: true })),
  };
  let fixture: ComponentFixture<CustomerDetailPageComponent>;

  beforeEach(async () => {
    vi.clearAllMocks();
    role.set('OWNER');
    detailState.set({ status: 'loaded', data: customer, error: null });
    const paramMap = convertToParamMap({ id: customer.id });
    const queryParamMap = convertToParamMap({ page: '2', limit: '50', q: 'ana' });
    TestBed.configureTestingModule({
      imports: [CustomerDetailPageComponent],
      providers: [
        provideRouter([]),
        { provide: CustomersStore, useValue: store },
        { provide: TenantStore, useValue: { role: role.asReadonly() } },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(paramMap), snapshot: { paramMap, queryParamMap } },
        },
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

  it('keeps list filters in back and edit links', () => {
    const links = Array.from(
      fixture.nativeElement.querySelectorAll('a') as NodeListOf<HTMLAnchorElement>,
    );

    expect(links.find((link) => link.textContent?.includes('Volver'))?.search).toBe(
      '?page=2&limit=50&q=ana',
    );
    expect(links.find((link) => link.textContent?.includes('Editar'))?.search).toBe(
      '?page=2&limit=50&q=ana',
    );
  });

  it('requires confirmation before OWNER logical deactivation', () => {
    detailState.set({ status: 'loaded', data: { ...customer, activo: true }, error: null });
    fixture.detectChanges();
    const deactivateButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.trim() === 'Desactivar') as HTMLButtonElement;

    deactivateButton.click();
    fixture.detectChanges();
    expect(store.deactivate).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('no se eliminará físicamente');
    const confirmButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.trim() === 'Confirmar baja lógica') as HTMLButtonElement;
    confirmButton.click();

    expect(store.deactivate).toHaveBeenCalledWith(customer.id);
  });

  it('reactivates an inactive customer as OWNER', () => {
    const reactivateButton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.trim() === 'Reactivar') as HTMLButtonElement;

    reactivateButton.click();

    expect(store.reactivate).toHaveBeenCalledWith(customer.id);
  });

  it('hides state actions from EMPLOYEE but keeps editing visible', () => {
    role.set('EMPLOYEE');
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Editar');
    expect(text).not.toContain('Desactivar');
    expect(text).not.toContain('Reactivar');
  });

  it('shows a forced 403 without changing the customer state', () => {
    const before = detailState();
    store.reactivate.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 403, statusText: 'Forbidden' })),
    );

    fixture.componentInstance.reactivate();
    fixture.detectChanges();

    expect(detailState()).toBe(before);
    expect(fixture.nativeElement.textContent).toContain('No tienes autorización');
  });
});
