import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import type { ReservationDetail, ReservationDetailState } from './reservation.models';
import { ReservationDetailPageComponent } from './reservation-detail-page.component';
import { ReservationsStore } from './reservations.store';

const id = '33333333-3333-4333-8333-333333333333';
const detail: ReservationDetail = {
  id,
  cliente: { id: 'customer-1', nombre: 'Ana López', telefono: '555', email: 'ana@example.com' },
  sucursal: { id: 'branch-1', nombre: 'Centro' },
  fechaInicio: '2026-12-10T23:00:00.000Z',
  fechaFin: '2026-12-12T23:00:00.000Z',
  estado: 'CANCELADA',
  notas: 'Entregar por la tarde',
  importeRenta: '1250.50',
  depositoRequerido: '500.00',
  vestidos: [
    {
      id: 'dress-1',
      codigo: 'GALA-1',
      nombre: 'Gala Roja',
      talla: 'M',
      color: 'Rojo',
      precioRenta: '1000.00',
      deposito: '400.00',
    },
  ],
  confirmadaAt: '2026-11-01T01:00:00.000Z',
  entregadaAt: null,
  devueltaAt: null,
  canceladaAt: '2026-11-02T01:00:00.000Z',
  motivoCancelacion: 'Cambio de evento',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-02T01:00:00.000Z',
};

describe('ReservationDetailPageComponent', () => {
  const detailState = signal<ReservationDetailState>({
    status: 'loaded',
    data: detail,
    error: null,
  });
  const store = { detailState: detailState.asReadonly(), loadDetail: vi.fn(() => of(undefined)) };
  let fixture: ComponentFixture<ReservationDetailPageComponent>;

  beforeEach(async () => {
    vi.clearAllMocks();
    detailState.set({ status: 'loaded', data: detail, error: null });
    const paramMap = convertToParamMap({ id });
    const queryParamMap = convertToParamMap({ page: '2', estado: 'CANCELADA' });
    await TestBed.configureTestingModule({
      imports: [ReservationDetailPageComponent],
      providers: [
        provideRouter([]),
        { provide: ReservationsStore, useValue: store },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(paramMap), snapshot: { paramMap, queryParamMap } },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ReservationDetailPageComponent);
    fixture.detectChanges();
  });

  it('renders full detail and historical snapshots', () => {
    const text = fixture.nativeElement.textContent;
    expect(store.loadDetail).toHaveBeenCalledWith(id);
    expect(text).toContain('Ana López');
    expect(text).toContain('Centro');
    expect(text).toContain('Cancelada');
    expect(text).toContain('GALA-1');
    expect(text).toContain('Precio histórico');
    expect(text).toContain('$1,000.00');
    expect(text).toContain('$400.00');
    expect(text).toContain('$1,250.50');
    expect(text).toContain('No son los precios actuales');
    expect(text).toContain('Cambio de evento');
    expect(text).toContain('Ciclo de vida');
  });

  it('renders a tenant-safe 404', () => {
    detailState.set({
      status: 'error',
      data: null,
      error: { status: 404, message: 'No encontrada' },
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('no existe o no está disponible');
    expect(fixture.nativeElement.textContent).not.toContain('schemaName');
  });

  it('preserves valid list filters in the back link', () => {
    const back = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(back.search).toBe('?page=2&limit=20&estado=CANCELADA');
  });
});
