import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import { TenantResetRegistry } from '../../core/tenant/tenant-reset-registry.service';
import { AuditApiService } from './audit-api.service';
import type { AuditEvent, PaginatedAuditEventsResponse } from './audit.models';
import { AuditStore } from './audit.store';

const event: AuditEvent = {
  id: '11111111-1111-4111-8111-111111111111',
  action: 'reservation.updated',
  resourceType: 'reservacion',
  resourceId: null,
  actor: null,
  metadata: {},
  ipAddress: null,
  userAgent: null,
  createdAt: '2026-11-24T15:00:00.000Z',
};

function page(data: readonly AuditEvent[] = [event]): PaginatedAuditEventsResponse {
  return {
    data,
    pagination: { page: 1, limit: 20, total: data.length, totalPages: data.length ? 1 : 0 },
  };
}

describe('AuditStore', () => {
  const api = { list: vi.fn(), getById: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.list.mockReturnValue(of(page()));
    api.getById.mockReturnValue(of(event));
    TestBed.configureTestingModule({
      providers: [AuditStore, TenantResetRegistry, { provide: AuditApiService, useValue: api }],
    });
  });

  it('loads list and detail', async () => {
    const store = TestBed.inject(AuditStore);
    await firstValueFrom(store.loadList({ page: 1, limit: 20 }));
    await firstValueFrom(store.loadDetail(event.id));
    expect(store.listState()).toMatchObject({ status: 'loaded', data: [event] });
    expect(store.detailState()).toEqual({ status: 'loaded', data: event, error: null });
  });

  it('ignores obsolete responses', () => {
    const oldRequest = new Subject<PaginatedAuditEventsResponse>();
    const newRequest = new Subject<PaginatedAuditEventsResponse>();
    const newer = { ...event, id: '22222222-2222-4222-8222-222222222222' };
    api.list.mockReturnValueOnce(oldRequest).mockReturnValueOnce(newRequest);
    const store = TestBed.inject(AuditStore);
    store.loadList({ page: 1, limit: 20, action: 'customer.updated' }).subscribe();
    store.loadList({ page: 1, limit: 20, action: 'dress.updated' }).subscribe();
    newRequest.next(page([newer]));
    oldRequest.next(page([event]));
    expect(store.listState().data).toEqual([newer]);
    expect(store.listState().filters.action).toBe('dress.updated');
  });

  it.each([403, 404])('preserves status %s for distinct UI handling', async (status) => {
    api.getById.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status, error: { message: 'Rejected' } })),
    );
    const store = TestBed.inject(AuditStore);
    await firstValueFrom(store.loadDetail('cross-tenant'));
    expect(store.detailState().error?.status).toBe(status);
  });

  it('clears state and pending requests when tenant changes', async () => {
    const pending = new Subject<PaginatedAuditEventsResponse>();
    api.list.mockReturnValueOnce(pending);
    const store = TestBed.inject(AuditStore);
    await firstValueFrom(store.loadDetail(event.id));
    store.loadList({ page: 2, limit: 20 }).subscribe();
    TestBed.inject(TenantResetRegistry).resetAll();
    pending.next(page());
    expect(store.listState().status).toBe('idle');
    expect(store.detailState()).toEqual({ status: 'idle', data: null, error: null });
  });
});
