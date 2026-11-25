import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import type { AuditDetailState, AuditEvent } from './audit.models';
import { AuditDetailPageComponent } from './audit-detail-page.component';
import { AuditStore } from './audit.store';

const event: AuditEvent = {
  id: '11111111-1111-4111-8111-111111111111',
  action: 'reservation.cancelled',
  resourceType: 'reservacion',
  resourceId: '22222222-2222-4222-8222-222222222222',
  actor: {
    id: '33333333-3333-4333-8333-333333333333',
    nombre: 'Owner Principal',
    email: 'owner@example.test',
    activo: true,
  },
  metadata: {
    previousState: 'CONFIRMADA',
    newState: 'CANCELADA',
    hasCancellationReason: true,
  },
  ipAddress: '203.0.113.10',
  userAgent: 'Test Browser',
  createdAt: '2026-11-24T15:00:00.000Z',
};

describe('AuditDetailPageComponent', () => {
  const detailState = signal<AuditDetailState>({ status: 'loaded', data: event, error: null });
  const store = { detailState: detailState.asReadonly(), loadDetail: vi.fn(() => of(undefined)) };
  const route = {
    paramMap: of(convertToParamMap({ id: event.id })),
    snapshot: {
      paramMap: convertToParamMap({ id: event.id }),
      queryParamMap: convertToParamMap({ page: '2' }),
    },
  };
  let fixture: ComponentFixture<AuditDetailPageComponent>;

  beforeEach(async () => {
    vi.clearAllMocks();
    detailState.set({ status: 'loaded', data: event, error: null });
    TestBed.configureTestingModule({
      imports: [AuditDetailPageComponent],
      providers: [
        provideRouter([]),
        { provide: AuditStore, useValue: store },
        { provide: ActivatedRoute, useValue: route },
      ],
    });
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(AuditDetailPageComponent);
    fixture.detectChanges();
  });

  it('shows known metadata as accessible labeled fields', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Reservación cancelada');
    expect(text).toContain('CONFIRMADA → CANCELADA');
    expect(text).toContain('Motivo de cancelación');
    expect(text).toContain('Registrado');
    expect(text).toContain('Owner Principal');
    expect(
      fixture.nativeElement.querySelector('[aria-labelledby="audit-changes-title"]'),
    ).not.toBeNull();
    expect(text).not.toMatch(/schemaName|tokenHash|password|authorization|tenant_/i);
  });

  it('renders cross-tenant 404 distinctly', () => {
    detailState.set({
      status: 'error',
      data: null,
      error: { status: 404, message: 'Not found' },
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'El evento no existe o pertenece a otra empresa.',
    );
  });
});
