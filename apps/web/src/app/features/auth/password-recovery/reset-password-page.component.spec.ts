import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { PasswordRecoveryApiService } from './password-recovery-api.service';
import type { PasswordRecoveryResponse } from './password-recovery.models';
import {
  passwordResetTokenFromFragment,
  ResetPasswordPageComponent,
} from './reset-password-page.component';

const token = 'A'.repeat(43);

describe('ResetPasswordPageComponent', () => {
  const route = { snapshot: { fragment: `token=${token}` as string | null } };
  const location = { replaceState: vi.fn() };
  const api = {
    reset: vi.fn(() => of({ message: 'Contraseña restablecida' })),
  };
  let fixture: ComponentFixture<ResetPasswordPageComponent>;
  let component: ResetPasswordPageComponent;
  let router: Router;
  let navigateSpy: ReturnType<typeof vi.spyOn>;
  let storageSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    route.snapshot.fragment = `token=${token}`;
    location.replaceState.mockReset();
    api.reset.mockReset().mockReturnValue(of({ message: 'Contraseña restablecida' }));
    storageSpy = vi.spyOn(Storage.prototype, 'setItem');
    await TestBed.configureTestingModule({
      imports: [ResetPasswordPageComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: route },
        { provide: Location, useValue: location },
        { provide: PasswordRecoveryApiService, useValue: api },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => storageSpy.mockRestore());

  function createComponent(): ResetPasswordPageComponent {
    fixture = TestBed.createComponent(ResetPasswordPageComponent);
    fixture.detectChanges();
    component = fixture.componentInstance;
    return component;
  }

  it('reads the fragment into memory and immediately removes it from the URL', () => {
    createComponent();

    expect(location.replaceState).toHaveBeenCalledOnce();
    expect(String(location.replaceState.mock.calls[0]?.[0])).not.toContain(token);
    expect(storageSpy).not.toHaveBeenCalled();
    expect(document.cookie).not.toContain(token);
  });

  it('validates password requirements and matching confirmation accessibly', () => {
    createComponent();
    component.form.setValue({ password: 'short', passwordConfirmation: 'different' });
    component.onSubmit();
    fixture.detectChanges();

    expect(api.reset).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('entre 8 y 1024 caracteres');
    expect(fixture.nativeElement.textContent).toContain('Las contraseñas deben coincidir');
    expect(fixture.nativeElement.querySelector('#new-password-help')).not.toBeNull();
  });

  it('sends no confirmation, clears sensitive state and returns safely to login', () => {
    createComponent();
    component.form.setValue({
      password: 'new-secure-password',
      passwordConfirmation: 'new-secure-password',
    });
    component.onSubmit();

    expect(api.reset).toHaveBeenCalledWith({ token, password: 'new-secure-password' });
    expect(JSON.stringify(api.reset.mock.calls)).not.toContain('passwordConfirmation');
    expect(component.form.getRawValue()).toEqual({ password: '', passwordConfirmation: '' });
    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { passwordRestablecida: 'true' },
      replaceUrl: true,
    });
    expect(JSON.stringify(navigateSpy.mock.calls)).not.toContain(token);
    expect(storageSpy).not.toHaveBeenCalled();
  });

  it('shows the same generic state for missing and rejected tokens', () => {
    route.snapshot.fragment = null;
    createComponent();
    expect(fixture.nativeElement.textContent).toContain('no es válido o ya no está disponible');
    expect(api.reset).not.toHaveBeenCalled();

    fixture.destroy();
    route.snapshot.fragment = `token=${token}`;
    api.reset.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({ status: 400, error: { message: `Internal detail ${token}` } }),
      ),
    );
    createComponent();
    component.form.setValue({
      password: 'new-secure-password',
      passwordConfirmation: 'new-secure-password',
    });
    component.onSubmit();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('no es válido o ya no está disponible');
    expect(fixture.nativeElement.textContent).not.toContain(token);
  });

  it('ignores a duplicate reset while the first request is pending', () => {
    const pending = new Subject<PasswordRecoveryResponse>();
    api.reset.mockReturnValueOnce(pending.asObservable());
    createComponent();
    component.form.setValue({
      password: 'new-secure-password',
      passwordConfirmation: 'new-secure-password',
    });

    component.onSubmit();
    component.onSubmit();

    expect(api.reset).toHaveBeenCalledOnce();
    expect(component.submitting()).toBe(true);
    pending.next({ message: 'Contraseña restablecida' });
    pending.complete();
    expect(component.submitting()).toBe(false);
  });
});

describe('passwordResetTokenFromFragment', () => {
  it('reads only the token fragment value', () => {
    expect(passwordResetTokenFromFragment('other=value&token=opaque%2Dtoken')).toBe('opaque-token');
    expect(passwordResetTokenFromFragment('token=')).toBeNull();
    expect(passwordResetTokenFromFragment(null)).toBeNull();
  });
});
