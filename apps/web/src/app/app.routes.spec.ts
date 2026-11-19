import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { routes } from './app.routes';
import { AuthStore } from './core/auth/auth.store';
import { API_BASE_URL } from './core/config/api-config';
import { TenantStore } from './core/tenant/tenant.store';

describe('application routes', () => {
  const authenticated = signal(false);
  const selectedTenant = signal(false);
  const company = {
    id: 'empresa-1',
    nombre: 'Atelier Norte',
    slug: 'atelier-norte',
    rol: 'OWNER' as const,
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
      ],
    });
  });

  it.each([
    ['/', 'Cada vestido.'],
    ['/login', 'Inicia sesión'],
    ['/seleccionar-empresa', 'Seleccionar empresa'],
    ['/app', 'Panel de operación'],
  ])('renders %s', async (url, expectedText) => {
    authenticated.set(['/seleccionar-empresa', '/app'].includes(url));
    selectedTenant.set(url === '/app');
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);

    expect(harness.routeNativeElement?.textContent).toContain(expectedText);
  });

  it('redirects unknown routes to the public home', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/ruta-inexistente');

    expect(harness.routeNativeElement?.textContent).toContain('Cada vestido.');
  });
});
