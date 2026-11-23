import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { PasswordRecoveryApiService } from './password-recovery-api.service';
import type { PasswordRecoveryResponse } from './password-recovery.models';
import { RequestPasswordPageComponent, retryAfterMessage } from './request-password-page.component';

describe('RequestPasswordPageComponent', () => {
  const genericMessage = 'Si la cuenta existe y está activa, recibirás instrucciones por correo.';
  const api = { request: vi.fn(() => of({ message: genericMessage })) };
  let fixture: ComponentFixture<RequestPasswordPageComponent>;
  let component: RequestPasswordPageComponent;

  beforeEach(async () => {
    vi.clearAllMocks();
    api.request.mockReturnValue(of({ message: genericMessage }));
    await TestBed.configureTestingModule({
      imports: [RequestPasswordPageComponent],
      providers: [provideRouter([]), { provide: PasswordRecoveryApiService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(RequestPasswordPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('validates required and malformed emails accessibly', () => {
    component.onSubmit();
    fixture.detectChanges();
    expect(api.request).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('correo electrónico es obligatorio');

    const emailInput = fixture.nativeElement.querySelector('#recovery-email') as HTMLInputElement;
    emailInput.value = 'correo-invalido';
    emailInput.dispatchEvent(new Event('input'));
    component.onSubmit();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ingresa un correo electrónico válido');
  });

  it('normalizes the email and renders only the generic backend response', () => {
    component.form.controls.email.setValue('  PERSON@Example.TEST  ');
    component.onSubmit();
    fixture.detectChanges();

    expect(api.request).toHaveBeenCalledWith({ email: 'person@example.test' });
    expect(fixture.nativeElement.textContent).toContain(genericMessage);
    expect(component.form.controls.email.value).toBe('');
  });

  it('shows the Retry-After delay for a rate-limited request', () => {
    api.request.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 429,
            headers: new HttpHeaders({ 'Retry-After': '45' }),
          }),
      ),
    );
    component.form.controls.email.setValue('person@example.test');
    component.onSubmit();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('nuevamente en 45 segundos');
  });

  it('ignores a duplicate submit while the request is pending', () => {
    const pending = new Subject<PasswordRecoveryResponse>();
    api.request.mockReturnValueOnce(pending.asObservable());
    component.form.controls.email.setValue('person@example.test');

    component.onSubmit();
    component.onSubmit();

    expect(api.request).toHaveBeenCalledOnce();
    expect(component.submitting()).toBe(true);
    pending.next({ message: genericMessage });
    pending.complete();
    expect(component.submitting()).toBe(false);
  });
});

describe('retryAfterMessage', () => {
  it('falls back safely when Retry-After is missing or invalid', () => {
    expect(retryAfterMessage(new HttpErrorResponse({ status: 429 }))).toContain('más tarde');
    expect(
      retryAfterMessage(
        new HttpErrorResponse({
          status: 429,
          headers: new HttpHeaders({ 'Retry-After': 'secret-value' }),
        }),
      ),
    ).not.toContain('secret-value');
  });
});
