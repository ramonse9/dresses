import { HttpErrorResponse } from '@angular/common/http';
import { Location } from '@angular/common';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { InvitationAcceptanceApiService } from './invitation-acceptance-api.service';
import {
  InvitationAcceptancePageComponent,
  invitationTokenFromFragment,
} from './invitation-acceptance-page.component';
import type {
  AcceptedInvitationResponse,
  VerifiedInvitation,
} from './invitation-acceptance.models';

const token = 'A'.repeat(43);
const newAccountInvitation: VerifiedInvitation = {
  empresaNombre: 'Atelier Norte',
  email: 'p***@example.test',
  rol: 'EMPLOYEE',
  expiresAt: '2026-12-01T12:00:00.000Z',
  accountExists: false,
};

describe('InvitationAcceptancePageComponent', () => {
  const route = { snapshot: { fragment: `token=${token}` as string | null } };
  const location = { replaceState: vi.fn() };
  const api = {
    verify: vi.fn(() => of(newAccountInvitation)),
    accept: vi.fn(() =>
      of({ accepted: true, message: 'Invitación aceptada' } as AcceptedInvitationResponse),
    ),
  };
  let fixture: ComponentFixture<InvitationAcceptancePageComponent>;
  let storageSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    route.snapshot.fragment = `token=${token}`;
    location.replaceState.mockReset();
    api.verify.mockReset().mockReturnValue(of(newAccountInvitation));
    api.accept
      .mockReset()
      .mockReturnValue(
        of({ accepted: true, message: 'Invitación aceptada' } as AcceptedInvitationResponse),
      );
    storageSpy = vi.spyOn(Storage.prototype, 'setItem');
    TestBed.configureTestingModule({
      imports: [InvitationAcceptancePageComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: route },
        { provide: Location, useValue: location },
        { provide: InvitationAcceptanceApiService, useValue: api },
      ],
    });
    await TestBed.compileComponents();
  });

  afterEach(() => storageSpy.mockRestore());

  function createComponent(): InvitationAcceptancePageComponent {
    fixture = TestBed.createComponent(InvitationAcceptancePageComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('reads the token from the fragment and immediately cleans the URL', () => {
    createComponent();
    expect(api.verify).toHaveBeenCalledWith(token);
    expect(location.replaceState).toHaveBeenCalledOnce();
    expect(String(location.replaceState.mock.calls[0]?.[0])).not.toContain(token);
    expect(storageSpy).not.toHaveBeenCalled();
  });

  it('shows the verified invitation without schema information', () => {
    createComponent();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Atelier Norte');
    expect(text).toContain('p***@example.test');
    expect(text).toContain('Empleado');
    expect(text).toContain('Dec 1, 2026');
    expect(text).not.toMatch(/schemaName|tenant_/);
    expect(fixture.nativeElement.querySelector('label[for="invitation-name"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('label[for="invitation-password"]')).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('label[for="invitation-password-confirmation"]'),
    ).not.toBeNull();
  });

  it('accepts a new account without sending password confirmation', () => {
    const component = createComponent();
    component.form.setValue({
      nombre: '  Ana López  ',
      password: 'secure-password',
      passwordConfirmation: 'secure-password',
    });
    component.acceptInvitation();
    fixture.detectChanges();

    expect(api.accept).toHaveBeenCalledWith({
      token,
      nombre: 'Ana López',
      password: 'secure-password',
    });
    expect(JSON.stringify(api.accept.mock.calls)).not.toContain('passwordConfirmation');
    expect(component.status()).toBe('accepted');
    expect(component.form.getRawValue()).toEqual({
      nombre: '',
      password: '',
      passwordConfirmation: '',
    });
    component.acceptInvitation();
    expect(api.accept).toHaveBeenCalledOnce();
    expect(storageSpy).not.toHaveBeenCalled();
  });

  it('asks an existing account only for the current password', () => {
    api.verify.mockReturnValueOnce(
      of({ ...newAccountInvitation, accountExists: true, rol: 'OWNER' }),
    );
    const component = createComponent();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Contraseña actual');
    expect(fixture.nativeElement.querySelector('#invitation-name')).toBeNull();
    expect(fixture.nativeElement.querySelector('#invitation-password-confirmation')).toBeNull();

    component.form.controls.password.setValue('current-password');
    component.acceptInvitation();
    expect(api.accept).toHaveBeenCalledWith({ token, password: 'current-password' });
  });

  it('shows the same generic state for a missing or rejected token', () => {
    route.snapshot.fragment = null;
    createComponent();
    expect(api.verify).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('no es válido, expiró o ya fue utilizado');

    fixture.destroy();
    route.snapshot.fragment = `token=${token}`;
    api.verify.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 400, error: { message: token } })),
    );
    createComponent();
    expect(fixture.nativeElement.textContent).toContain('no es válido, expiró o ya fue utilizado');
    expect(fixture.nativeElement.textContent).not.toContain(token);
  });

  it('handles an incorrect existing password without exposing backend details', () => {
    api.verify.mockReturnValueOnce(of({ ...newAccountInvitation, accountExists: true }));
    api.accept.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 401,
            error: { message: `Internal password detail ${token}` },
          }),
      ),
    );
    const component = createComponent();
    component.form.controls.password.setValue('incorrect-password');
    component.acceptInvitation();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('contraseña actual no es correcta');
    expect(fixture.nativeElement.textContent).not.toContain(token);
    expect(component.form.controls.password.value).toBe('');
  });

  it('prevents duplicate acceptance requests', () => {
    const pending = new Subject<AcceptedInvitationResponse>();
    api.accept.mockReturnValueOnce(pending.asObservable());
    const component = createComponent();
    component.form.setValue({
      nombre: 'Ana',
      password: 'secure-password',
      passwordConfirmation: 'secure-password',
    });
    component.acceptInvitation();
    component.acceptInvitation();
    expect(api.accept).toHaveBeenCalledOnce();
    expect(component.submitting()).toBe(true);
    pending.next({ accepted: true, message: 'Invitación aceptada' });
    pending.complete();
    expect(component.submitting()).toBe(false);
  });
});

describe('invitationTokenFromFragment', () => {
  it('reads only the token fragment value', () => {
    expect(invitationTokenFromFragment('other=value&token=opaque%2Dtoken')).toBe('opaque-token');
    expect(invitationTokenFromFragment('token=')).toBeNull();
    expect(invitationTokenFromFragment(null)).toBeNull();
  });
});
