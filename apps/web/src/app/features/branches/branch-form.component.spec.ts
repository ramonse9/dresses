import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { BranchFormComponent } from './branch-form.component';

describe('BranchFormComponent', () => {
  let fixture: ComponentFixture<BranchFormComponent>;
  let component: BranchFormComponent;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [BranchFormComponent] });
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(BranchFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('normalizes text and converts empty optional values to null', () => {
    const submitted = vi.fn();
    component.submitted.subscribe(submitted);
    component.form.setValue({
      nombre: '  Centro  ',
      direccion: '  Av. Principal 123  ',
      telefono: '   ',
    });

    component.onSubmit();

    expect(submitted).toHaveBeenCalledWith({
      nombre: 'Centro',
      direccion: 'Av. Principal 123',
      telefono: null,
    });
  });

  it.each([
    ['nombre', 'A'],
    ['nombre', 'A'.repeat(161)],
    ['direccion', 'A'.repeat(256)],
    ['telefono', '1'.repeat(41)],
  ] as const)('rejects invalid %s values', (field, value) => {
    const submitted = vi.fn();
    component.submitted.subscribe(submitted);
    component.form.setValue({ nombre: 'Centro', direccion: '', telefono: '' });
    component.form.controls[field].setValue(value);

    component.onSubmit();

    expect(component.form.controls[field].invalid).toBe(true);
    expect(submitted).not.toHaveBeenCalled();
  });

  it('rejects duplicate submissions', () => {
    const submitted = vi.fn();
    component.submitted.subscribe(submitted);
    component.form.setValue({ nombre: 'Centro', direccion: '', telefono: '' });

    component.onSubmit();
    component.onSubmit();

    expect(submitted).toHaveBeenCalledOnce();
  });
});
