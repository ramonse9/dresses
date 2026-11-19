import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { routes } from './app.routes';
import { AuthStore } from './core/auth/auth.store';
import { API_BASE_URL } from './core/config/api-config';
import { TenantStore } from './core/tenant/tenant.store';
import { BranchesStore } from './features/branches/branches.store';
import { CustomersStore } from './features/customers/customers.store';

describe('application routes', () => {
  const authenticated = signal(false);
  const selectedTenant = signal(false);
  const company = {
    id: 'empresa-1',
    nombre: 'Atelier Norte',
    slug: 'atelier-norte',
    rol: 'OWNER' as const,
  };
  const branch = {
    id: '11111111-1111-4111-8111-111111111111',
    nombre: 'Sucursal Centro',
    direccion: 'Av. Principal 123',
    telefono: '555-0100',
    activo: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const customer = {
    id: '22222222-2222-4222-8222-222222222222',
    nombre: 'Ana López',
    telefono: '555-0200',
    email: 'ana@example.com',
    direccion: 'Calle Rosa 25',
    notas: 'Cliente frecuente',
    activo: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    authenticated.set(false);
    selectedTenant.set(false);
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: API_BASE_URL, useValue: 'http://localhost:3000/api' },
        {
          provide: AuthStore,
          useValue: {
            isAuthenticated: authenticated.asReadonly(),
            user: signal(null).asReadonly(),
          },
        },
        {
          provide: TenantStore,
          useValue: {
            initialize: () => of(undefined),
            hasSelectedTenant: selectedTenant.asReadonly(),
            selectedCompany: signal(company).asReadonly(),
            role: signal('OWNER').asReadonly(),
            status: signal('ready').asReadonly(),
            loading: signal(false).asReadonly(),
            companies: signal([company]).asReadonly(),
            selectCompany: () => of(undefined),
          },
        },
        {
          provide: BranchesStore,
          useValue: {
            listState: signal({ status: 'loaded', data: [branch], error: null }).asReadonly(),
            detailState: signal({ status: 'loaded', data: branch, error: null }).asReadonly(),
            loadList: () => of(undefined),
            loadDetail: () => of(undefined),
            create: () => of(branch),
            update: () => of(branch),
            deactivate: () => of({ ...branch, activo: false }),
            reactivate: () => of(branch),
          },
        },
        {
          provide: CustomersStore,
          useValue: {
            listState: signal({
              status: 'loaded',
              data: [customer],
              pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
              filters: { page: 1, limit: 20 },
              error: null,
            }).asReadonly(),
            detailState: signal({
              status: 'loaded',
              data: customer,
              error: null,
            }).asReadonly(),
            loadList: () => of(undefined),
            loadDetail: () => of(undefined),
          },
        },
      ],
    });
  });

  it.each([
    ['/', 'Cada vestido.'],
    ['/login', 'Inicia sesión'],
    ['/seleccionar-empresa', 'Seleccionar empresa'],
    ['/app', 'Panel de operación'],
    ['/app/dashboard', 'Panel de operación'],
    ['/app/sucursales', 'Sucursales'],
    ['/app/sucursales/nueva', 'Crear sucursal'],
    [`/app/sucursales/${branch.id}`, 'Sucursal Centro'],
    [`/app/sucursales/${branch.id}/editar`, 'Sucursal Centro'],
    ['/app/clientes', 'Clientes'],
    [`/app/clientes/${customer.id}`, 'Ana López'],
    ['/app/vestidos', 'Vestidos'],
    ['/app/disponibilidad', 'Disponibilidad'],
    ['/app/reservaciones', 'Reservaciones'],
  ])('renders %s', async (url, expectedText) => {
    authenticated.set(url === '/seleccionar-empresa' || url.startsWith('/app'));
    selectedTenant.set(url.startsWith('/app'));
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);

    expect(harness.routeNativeElement?.textContent).toContain(expectedText);
  });

  it('redirects the app root to the dashboard child route', async () => {
    authenticated.set(true);
    selectedTenant.set(true);
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/app');

    expect(TestBed.inject(Router).url).toBe('/app/dashboard');
  });

  it('redirects unknown routes to the public home', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/ruta-inexistente');

    expect(harness.routeNativeElement?.textContent).toContain('Cada vestido.');
  });
});
