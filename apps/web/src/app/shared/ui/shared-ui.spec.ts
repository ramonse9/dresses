import { TestBed } from '@angular/core/testing';
import { EmptyStateComponent } from './empty-state/empty-state.component';
import { ErrorMessageComponent } from './error-message/error-message.component';
import { LoadingIndicatorComponent } from './loading-indicator/loading-indicator.component';
import { SubmitButtonComponent } from './submit-button/submit-button.component';

describe('shared UI states', () => {
  it('renders a loading status', () => {
    const fixture = TestBed.createComponent(LoadingIndicatorComponent);
    fixture.componentRef.setInput('label', 'Consultando vestidos…');
    fixture.detectChanges();

    const status = fixture.nativeElement.querySelector('[role="status"]') as HTMLElement;
    expect(status.textContent).toContain('Consultando vestidos…');
  });

  it('renders normalized errors accessibly', () => {
    const fixture = TestBed.createComponent(ErrorMessageComponent);
    fixture.componentRef.setInput('error', { status: 409, message: 'Conflicto de disponibilidad' });
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain('Conflicto de disponibilidad');
  });

  it('renders an empty state', () => {
    const fixture = TestBed.createComponent(EmptyStateComponent);
    fixture.componentRef.setInput('title', 'Sin sucursales');
    fixture.componentRef.setInput('description', 'Crea una sucursal para comenzar.');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Sin sucursales');
    expect(fixture.nativeElement.textContent).toContain('Crea una sucursal para comenzar.');
  });

  it('disables the submit button while loading', () => {
    const fixture = TestBed.createComponent(SubmitButtonComponent);
    fixture.componentRef.setInput('loading', true);
    fixture.componentRef.setInput('loadingLabel', 'Creando…');
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.textContent).toContain('Creando…');
  });
});
