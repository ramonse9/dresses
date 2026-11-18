import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { API_BASE_URL } from './core/config/api-config';

describe('application routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: API_BASE_URL, useValue: 'http://localhost:3000/api' },
      ],
    });
  });

  it.each([
    ['/', 'Cada vestido.'],
    ['/login', 'Acceso'],
    ['/seleccionar-empresa', 'Seleccionar empresa'],
    ['/app', 'Panel de operación'],
  ])('renders %s', async (url, expectedText) => {
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
