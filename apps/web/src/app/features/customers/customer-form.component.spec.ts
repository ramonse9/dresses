import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CustomerFormComponent } from './customer-form.component';

describe('CustomerFormComponent', () => {
  let fixture: ComponentFixture<CustomerFormComponent>;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [CustomerFormComponent] });
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(CustomerFormComponent);
    fixture.detectChanges();
  });

  it('requires a name and at least one contact method', () => {
    const submitted = vi.fn();
    fixture.componentInstance.submitted.subscribe(submitted);

    fixture.componentInstance.form.setValue({
      nombre: 'Ana',
      telefono: '   ',
      email: '   ',
      direccion: '',
      notas: '',
    });
    fixture.componentInstance.onSubmit();
    fixture.detectChanges();

    expect(submitted).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('al menos un teléfono o un email');
  });

  it('normalizes text, lowercases email and converts empty optionals to null', () => {
    const submitted = vi.fn();
    fixture.componentInstance.submitted.subscribe(submitted);
    fixture.componentInstance.form.setValue({
      nombre: '  Ana López  ',
      telefono: '  555-0100  ',
      email: '  ANA@EXAMPLE.COM  ',
      direccion: '   ',
      notas: '  Prefiere tardes  ',
    });

    fixture.componentInstance.onSubmit();

    expect(submitted).toHaveBeenCalledWith({
      nombre: 'Ana López',
      telefono: '555-0100',
      email: 'ana@example.com',
      direccion: null,
      notas: 'Prefiere tardes',
    });
  });

  it('does not include activo in the emitted general update data', () => {
    const submitted = vi.fn();
    fixture.componentInstance.submitted.subscribe(submitted);
    fixture.componentInstance.form.setValue({
      nombre: 'Ana',
      telefono: '',
      email: 'ana@example.com',
      direccion: '',
      notas: '',
    });

    fixture.componentInstance.onSubmit();

    expect(JSON.stringify(submitted.mock.calls)).not.toContain('activo');
  });

  it('rejects an invalid email', () => {
    const submitted = vi.fn();
    fixture.componentInstance.submitted.subscribe(submitted);
    fixture.componentInstance.form.setValue({
      nombre: 'Ana',
      telefono: '',
      email: 'correo-invalido',
      direccion: '',
      notas: '',
    });

    fixture.componentInstance.onSubmit();
    fixture.detectChanges();

    expect(submitted).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('email válido');
  });
});
