import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  convertToParamMap,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { authGuard, guestGuard } from './auth.guards';
import { AuthStore } from './auth.store';
import { sanitizeReturnUrl } from './return-url';

describe('authentication guards and returnUrl', () => {
  const authenticated = signal(false);
  let router: Router;

  beforeEach(() => {
    authenticated.set(false);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: { isAuthenticated: authenticated.asReadonly() },
        },
      ],
    });
    router = TestBed.inject(Router);
  });

  it('redirects anonymous users to login with an internal returnUrl', () => {
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/app?tab=hoy' } as RouterStateSnapshot),
    );

    expect(router.serializeUrl(result as UrlTree)).toBe('/login?returnUrl=%2Fapp%3Ftab%3Dhoy');
  });

  it('allows authenticated routes and redirects authenticated guests', () => {
    authenticated.set(true);

    const allowed = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/app' } as RouterStateSnapshot),
    );
    const redirected = TestBed.runInInjectionContext(() =>
      guestGuard(
        {
          queryParamMap: convertToParamMap({ returnUrl: '/app?tab=hoy' }),
        } as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
      ),
    );

    expect(allowed).toBe(true);
    expect(router.serializeUrl(redirected as UrlTree)).toBe('/app?tab=hoy');
  });

  it('rejects external, protocol-relative and encoded external return URLs', () => {
    expect(sanitizeReturnUrl('/app?tab=hoy#detalle')).toBe('/app?tab=hoy#detalle');
    expect(sanitizeReturnUrl('https://evil.example')).toBeNull();
    expect(sanitizeReturnUrl('//evil.example/path')).toBeNull();
    expect(sanitizeReturnUrl('%2F%2Fevil.example/path')).toBeNull();
    expect(sanitizeReturnUrl('/\\evil.example')).toBeNull();
  });

  it('uses the authenticated home when a guest returnUrl is unsafe', () => {
    authenticated.set(true);
    const result = TestBed.runInInjectionContext(() =>
      guestGuard(
        {
          queryParamMap: convertToParamMap({
            returnUrl: 'https://evil.example',
          }),
        } as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
      ),
    );

    expect(router.serializeUrl(result as UrlTree)).toBe('/seleccionar-empresa');
  });
});
