import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { DressFormComponent, normalizeMoney } from './dress-form.component';
import { dressMutationErrorMessage } from './dress-error-message';

const branch = {
  id: '11111111-1111-4111-8111-111111111111',
  nombre: 'Centro',
  direccion: null,
  telefono: null,
  activo: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('DressFormComponent', () => {
  let fixture: ComponentFixture<DressFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DressFormComponent] }).compileComponents();
    fixture = TestBed.createComponent(DressFormComponent);
    fixture.componentRef.setInput('branches', [branch]);
    fixture.detectChanges();
  });

  it('normalizes code, optional values and decimal strings without Number', () => {
    const submitted = vi.fn();
    fixture.componentInstance.submitted.subscribe(submitted);
    fixture.componentInstance.form.setValue({
      sucursalId: branch.id,
      codigo: '  gala-01  ',
      nombre: '  Gala roja  ',
      descripcion: '  ',
      talla: ' M ',
      color: ' Rojo ',
      marca: ' ',
      precioRenta: '1250.5',
      deposito: '0',
      estadoOperativo: 'DISPONIBLE',
      activo: true,
    });
    fixture.componentInstance.onSubmit();

    expect(submitted).toHaveBeenCalledWith(
      expect.objectContaining({
        codigo: 'GALA-01',
        nombre: 'Gala roja',
        descripcion: null,
        marca: null,
        precioRenta: '1250.50',
        deposito: '0.00',
      }),
    );
  });

  it.each(['-1', '1.234', '10000000000.00', '1e3'])('rejects invalid money %s', (value) => {
    fixture.componentInstance.form.controls.precioRenta.setValue(value);
    expect(fixture.componentInstance.form.controls.precioRenta.invalid).toBe(true);
  });

  it('prevents a duplicate synchronous submission', () => {
    const submitted = vi.fn();
    fixture.componentInstance.submitted.subscribe(submitted);
    fixture.componentInstance.form.patchValue({
      sucursalId: branch.id,
      codigo: 'A-1',
      nombre: 'Gala',
      talla: 'M',
      color: 'Rojo',
      precioRenta: '100.00',
    });
    fixture.componentInstance.onSubmit();
    fixture.componentInstance.onSubmit();
    expect(submitted).toHaveBeenCalledTimes(1);
  });
});

describe('normalizeMoney', () => {
  it('keeps exact decimal text', () => {
    expect(normalizeMoney('0001.00')).toBeNull();
    expect(normalizeMoney('1.2')).toBe('1.20');
    expect(normalizeMoney('0')).toBe('0.00');
  });
});

describe('dressMutationErrorMessage', () => {
  it('maps authorization, missing resource and duplicate code errors', () => {
    expect(dressMutationErrorMessage({ status: 403, message: '' })).toContain('autorización');
    expect(dressMutationErrorMessage({ status: 404, message: '' })).toContain('no existe');
    expect(dressMutationErrorMessage({ status: 409, message: '' })).toContain('código');
  });
});
