import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import type { AuthenticatedUser } from '../../../core/auth/auth.models';
import { LoginPageComponent } from './login-page.component';

describe('LoginPageComponent', () => {
  const user: AuthenticatedUser = {
    sub: '019a6f33-82b7-7a22-971b-6a8d7c5e4f30',
    email: 'owner@example.com',
    sessionId: '47ecf96a-8f2c-4e07-bd1f-93936f2cdb90',
  };
  const authStore = {
    login: vi.fn(),
    isAuthenticated: signal(false),
  };
  let fixture: ComponentFixture<LoginPageComponent>;
  let component: LoginPageComponent;
  let router: Router;

  beforeEach(async () => {
    vi.clearAllMocks();
    authStore.login.mockReturnValue(of(user));
    await TestBed.configureTestingModule({
      imports: [LoginPageComponent],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: authStore },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({}),
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPageComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture.detectChanges();
  });

  it('contains only expected fields and renders accessible validation messages', () => {
    expect(Object.keys(component.form.controls)).toEqual(['email', 'password']);

    component.onSubmit();
    fixture.detectChanges();

    expect(authStore.login).not.toHaveBeenCalled();
    const alerts = fixture.nativeElement.querySelectorAll('[role="alert"]');
    expect(Array.from<HTMLElement>(alerts).map((alert) => alert.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('correo electrónico es obligatorio'),
        expect.stringContaining('contraseña es obligatoria'),
      ]),
    );

    const emailInput = fixture.nativeElement.querySelector('#email') as HTMLInputElement;
    emailInput.value = 'correo-invalido';
    emailInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ingresa un correo electrónico válido.');
  });

  it('logs in once and navigates to the next authentication step', () => {
    component.form.setValue({
      email: ' Owner@Example.COM ',
      password: 'correct-password',
    });

    component.onSubmit();

    expect(authStore.login).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'correct-password',
    });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/seleccionar-empresa');
  });

  it('shows one generic message for incorrect credentials', () => {
    authStore.login.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 401 })));
    component.form.setValue({
      email: 'owner@example.com',
      password: 'incorrect-password',
    });

    component.onSubmit();
    fixture.detectChanges();

    expect(component.errorMessage()).toBe('Correo o contraseña incorrectos.');
    expect(fixture.nativeElement.textContent).not.toContain('Credenciales inválidas');
  });

  it('disables submission and ignores a double submit while pending', () => {
    const pendingLogin = new Subject<AuthenticatedUser>();
    authStore.login.mockReturnValueOnce(pendingLogin);
    component.form.setValue({
      email: 'owner@example.com',
      password: 'password',
    });

    component.onSubmit();
    component.onSubmit();
    fixture.detectChanges();

    expect(authStore.login).toHaveBeenCalledOnce();
    expect(component.submitting()).toBe(true);
    expect(
      (fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement).disabled,
    ).toBe(true);

    pendingLogin.next(user);
    pendingLogin.complete();
    expect(component.submitting()).toBe(false);
  });
});
