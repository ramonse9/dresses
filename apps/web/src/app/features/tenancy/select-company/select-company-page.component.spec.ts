import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthLogoutService } from '../../../core/auth/auth-logout.service';
import type { AvailableCompany } from '../../../core/tenant/tenant.models';
import { TenantStore } from '../../../core/tenant/tenant.store';
import { SelectCompanyPageComponent } from './select-company-page.component';

const companies: AvailableCompany[] = [
  { id: 'empresa-1', nombre: 'Atelier Norte', slug: 'atelier-norte', rol: 'OWNER' },
  { id: 'empresa-2', nombre: 'Atelier Sur', slug: 'atelier-sur', rol: 'EMPLOYEE' },
];

describe('SelectCompanyPageComponent', () => {
  const status = signal<'ready' | 'empty' | 'loading' | 'error'>('ready');
  const availableCompanies = signal<AvailableCompany[]>(companies);
  const selected = signal(false);
  const tenantStore = {
    initialize: vi.fn(() => of(undefined)),
    reloadCompanies: vi.fn(() => of(undefined)),
    selectCompany: vi.fn(() => of(undefined)),
    status: status.asReadonly(),
    companies: availableCompanies.asReadonly(),
    loading: signal(false).asReadonly(),
    hasSelectedTenant: selected.asReadonly(),
  };
  const authLogout = { logout: vi.fn(() => of(undefined)) };
  const router = { navigateByUrl: vi.fn(() => Promise.resolve(true)) };

  async function createFixture(
    change = false,
  ): Promise<ComponentFixture<SelectCompanyPageComponent>> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [SelectCompanyPageComponent],
      providers: [
        provideRouter([]),
        { provide: TenantStore, useValue: tenantStore },
        { provide: AuthLogoutService, useValue: authLogout },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap(change ? { change: 'true' } : {}) },
          },
        },
      ],
    });
    await TestBed.compileComponents();
    const fixture = TestBed.createComponent(SelectCompanyPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    status.set('ready');
    availableCompanies.set(companies);
    selected.set(false);
  });

  it('renders only the companies supplied by the tenant store', async () => {
    const fixture = await createFixture();

    expect(fixture.nativeElement.textContent).toContain('Atelier Norte');
    expect(fixture.nativeElement.textContent).toContain('Atelier Sur');
    expect(fixture.nativeElement.textContent).not.toContain('schemaName');
  });

  it('shows an informative state when no company is available', async () => {
    status.set('empty');
    availableCompanies.set([]);
    const fixture = await createFixture();

    expect(fixture.nativeElement.textContent).toContain('Aún no tienes empresas disponibles');
    expect(fixture.nativeElement.textContent).not.toContain('error');
    expect(fixture.nativeElement.textContent).toContain('Seguridad de la cuenta');
  });

  it('selects a company and navigates to the private area', async () => {
    const fixture = await createFixture();
    const buttons = fixture.nativeElement.querySelectorAll('button');

    buttons[1].click();
    fixture.detectChanges();

    expect(tenantStore.selectCompany).toHaveBeenCalledWith('empresa-1');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/app');
  });

  it('refreshes memberships and avoids redirect loops in change mode', async () => {
    selected.set(true);
    await createFixture(true);

    expect(tenantStore.reloadCompanies).toHaveBeenCalledOnce();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('redirects an automatically selected company outside change mode', async () => {
    selected.set(true);
    await createFixture();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/app');
  });
});
