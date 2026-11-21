import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthLogoutService } from '../../core/auth/auth-logout.service';
import { AuthStore } from '../../core/auth/auth.store';
import type { AvailableCompany, EmpresaRole } from '../../core/tenant/tenant.models';
import { TenantStore } from '../../core/tenant/tenant.store';
import { AppLayoutComponent } from './app-layout.component';

describe('AppLayoutComponent', () => {
  const authenticated = signal(true);
  const user = signal({ sub: 'user-1', email: 'owner@example.com', sessionId: 'session-1' });
  const company = signal<AvailableCompany | null>({
    id: 'empresa-1',
    nombre: 'Atelier Norte',
    slug: 'atelier-norte',
    rol: 'OWNER',
  });
  const role = signal<EmpresaRole | null>('OWNER');
  const hasSelectedTenant = signal(true);
  const authLogout = { logout: vi.fn(() => of(undefined)) };
  let fixture: ComponentFixture<AppLayoutComponent>;

  beforeEach(async () => {
    vi.clearAllMocks();
    authenticated.set(true);
    company.set({
      id: 'empresa-1',
      nombre: 'Atelier Norte',
      slug: 'atelier-norte',
      rol: 'OWNER',
    });
    role.set('OWNER');
    hasSelectedTenant.set(true);
    TestBed.configureTestingModule({
      imports: [AppLayoutComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: {
            isAuthenticated: authenticated.asReadonly(),
            user: user.asReadonly(),
          },
        },
        {
          provide: TenantStore,
          useValue: {
            selectedCompany: company.asReadonly(),
            role: role.asReadonly(),
            hasSelectedTenant: hasSelectedTenant.asReadonly(),
          },
        },
        { provide: AuthLogoutService, useValue: authLogout },
      ],
    });
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(AppLayoutComponent);
    fixture.detectChanges();
  });

  it('renders the selected company, current role, user menu and consultation navigation', () => {
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Atelier Norte');
    expect(text).toContain('Propietario');
    expect(text).toContain('owner@example.com');
    for (const label of [
      'Dashboard',
      'Sucursales',
      'Clientes',
      'Vestidos',
      'Disponibilidad',
      'Reservaciones',
      'Equipo',
    ]) {
      expect(text).toContain(label);
    }
  });

  it('renders the same consultation navigation for EMPLOYEE', () => {
    role.set('EMPLOYEE');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Empleado');
    expect(fixture.nativeElement.textContent).toContain('Reservaciones');
    expect(fixture.nativeElement.textContent).not.toContain('Equipo');
  });

  it('opens and closes the accessible mobile menu', () => {
    const trigger: HTMLButtonElement = fixture.nativeElement.querySelector(
      'button[aria-controls="mobile-navigation"]',
    );

    trigger.click();
    fixture.detectChanges();

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('nav[aria-label="Navegación principal móvil"]'),
    ).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('provides keyboard landmarks and visible focus hooks', () => {
    expect(fixture.nativeElement.querySelector('a[href="#main-content"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('main#main-content[tabindex="-1"]')).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('nav[aria-label="Navegación principal"]'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('summary[aria-label="Abrir menú de usuario"]'),
    ).not.toBeNull();
  });

  it('links company changes to the verified selection flow', () => {
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector(
      'a[href^="/seleccionar-empresa"]',
    );

    expect(link.getAttribute('href')).toContain('/seleccionar-empresa');
    expect(link.getAttribute('href')).toContain('change=true');
  });

  it('logs out through the shared logout service', () => {
    const buttons = fixture.nativeElement.querySelectorAll(
      'button',
    ) as NodeListOf<HTMLButtonElement>;
    const button = [...buttons].find(
      (candidate) => candidate.textContent?.trim() === 'Cerrar sesión',
    ) as HTMLButtonElement;

    button.click();

    expect(authLogout.logout).toHaveBeenCalledOnce();
  });

  it('shows a clear warning when the company access expires', () => {
    company.set(null);
    role.set(null);
    hasSelectedTenant.set(false);
    fixture.detectChanges();

    const alert: HTMLElement = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert.textContent).toContain('acceso a la empresa expiró');
    expect(alert.textContent).toContain('Seleccionar empresa');
  });

  it('shows a clear warning when the authenticated session expires', () => {
    authenticated.set(false);
    fixture.detectChanges();

    const alert: HTMLElement = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert.textContent).toContain('sesión expiró');
    expect(alert.textContent).toContain('Iniciar sesión');
  });
});
