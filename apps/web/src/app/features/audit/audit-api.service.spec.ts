import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { ApiClient } from '../../core/http/api-client.service';
import { AuditApiService } from './audit-api.service';

const rawEvent = {
  id: '11111111-1111-4111-8111-111111111111',
  action: 'reservation.updated',
  resourceType: 'reservacion',
  resourceId: '22222222-2222-4222-8222-222222222222',
  actor: null,
  metadata: { newState: 'CONFIRMADA', tokenHash: 'must-disappear' },
  ipAddress: null,
  userAgent: null,
  createdAt: '2026-11-24T15:00:00.000Z',
  schemaName: 'tenant_must_disappear',
};

describe('AuditApiService', () => {
  const api = { get: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockReturnValue(
      of({ data: [rawEvent], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } }),
    );
    TestBed.configureTestingModule({
      providers: [AuditApiService, { provide: ApiClient, useValue: api }],
    });
  });

  it('maps frontend actor filter to the API contract without tenant selectors', async () => {
    const response = await firstValueFrom(
      TestBed.inject(AuditApiService).list({
        page: 2,
        limit: 50,
        action: 'reservation.updated',
        resourceType: 'reservacion',
        resourceId: rawEvent.resourceId,
        actor: '33333333-3333-4333-8333-333333333333',
        fechaDesde: '2026-11-20T00:00:00.000Z',
        fechaHasta: '2026-11-25T00:00:00.000Z',
      }),
    );

    expect(api.get).toHaveBeenCalledWith('auditoria', {
      params: {
        page: 2,
        limit: 50,
        action: 'reservation.updated',
        resourceType: 'reservacion',
        resourceId: rawEvent.resourceId,
        actorUsuarioId: '33333333-3333-4333-8333-333333333333',
        fechaDesde: '2026-11-20T00:00:00.000Z',
        fechaHasta: '2026-11-25T00:00:00.000Z',
      },
    });
    expect(response.data[0]?.metadata).toEqual({ newState: 'CONFIRMADA' });
    expect(JSON.stringify(response)).not.toMatch(/schemaName|tokenHash|tenant_/);
  });

  it('loads encoded detail and projects the response', async () => {
    api.get.mockReturnValueOnce(of(rawEvent));
    const event = await firstValueFrom(TestBed.inject(AuditApiService).getById('event/id'));
    expect(api.get).toHaveBeenCalledWith('auditoria/event%2Fid');
    expect(event.id).toBe(rawEvent.id);
  });
});
