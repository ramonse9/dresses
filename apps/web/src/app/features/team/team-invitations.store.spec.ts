import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import { TenantResetRegistry } from '../../core/tenant/tenant-reset-registry.service';
import type { PaginatedTeamInvitationsResponse, TeamInvitation } from './team-invitation.models';
import { TeamInvitationsApiService } from './team-invitations-api.service';
import { TeamInvitationsStore } from './team-invitations.store';

const invitation: TeamInvitation = {
  id: 'invitation-1',
  email: 'persona@example.test',
  rol: 'EMPLOYEE',
  estado: 'PENDIENTE',
  expiresAt: '2026-12-01T12:00:00.000Z',
  lastSentAt: '2026-11-22T12:00:00.000Z',
  sendCount: 1,
  createdAt: '2026-11-22T12:00:00.000Z',
};

function response(
  data: readonly TeamInvitation[] = [invitation],
): PaginatedTeamInvitationsResponse {
  return {
    data,
    pagination: { page: 1, limit: 20, total: data.length, totalPages: data.length ? 1 : 0 },
  };
}

describe('TeamInvitationsStore', () => {
  const api = {
    list: vi.fn(() => of(response())),
    create: vi.fn(() => of(invitation)),
    resend: vi.fn(() => of(invitation)),
    revoke: vi.fn(() => of({ ...invitation, estado: 'REVOCADA' as const })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.list.mockReturnValue(of(response()));
    api.create.mockReturnValue(of(invitation));
    api.resend.mockReturnValue(of(invitation));
    api.revoke.mockReturnValue(of({ ...invitation, estado: 'REVOCADA' as const }));
    TestBed.configureTestingModule({
      providers: [
        TeamInvitationsStore,
        TenantResetRegistry,
        { provide: TeamInvitationsApiService, useValue: api },
      ],
    });
  });

  it('loads invitations and ignores obsolete responses', () => {
    const first = new Subject<PaginatedTeamInvitationsResponse>();
    const second = new Subject<PaginatedTeamInvitationsResponse>();
    api.list.mockReturnValueOnce(first.asObservable()).mockReturnValueOnce(second.asObservable());
    const store = TestBed.inject(TeamInvitationsStore);
    const newer = { ...invitation, id: 'invitation-2', email: 'newer@example.test' };
    store.load({ page: 1, limit: 20, q: 'old' }).subscribe();
    store.load({ page: 1, limit: 20, q: 'new' }).subscribe();

    second.next(response([newer]));
    first.next(response([invitation]));
    expect(store.state().data).toEqual([newer]);
    expect(store.state().filters.q).toBe('new');
    expect(JSON.stringify(store.state())).not.toMatch(/token|tokenHash|schemaName|tenant_/);
  });

  it('reloads authoritative data after every mutation and preserves filters', async () => {
    const store = TestBed.inject(TeamInvitationsStore);
    const filters = { page: 2, limit: 10, estado: 'PENDIENTE' as const, q: 'persona' };
    await firstValueFrom(store.load(filters));
    await firstValueFrom(store.create({ email: invitation.email, rol: 'EMPLOYEE' }));
    await firstValueFrom(store.resend(invitation.id));
    await firstValueFrom(store.revoke(invitation.id));

    expect(api.list).toHaveBeenCalledTimes(4);
    expect(api.list).toHaveBeenLastCalledWith(filters);
    expect(store.state().filters).toEqual(filters);
  });

  it.each([403, 409, 429, 503])(
    'does not change local state after mutation status %s',
    async (status) => {
      const store = TestBed.inject(TeamInvitationsStore);
      await firstValueFrom(store.load({ page: 1, limit: 20 }));
      const before = store.state();
      api.resend.mockReturnValueOnce(
        throwError(() => new HttpErrorResponse({ status, error: { message: 'Rejected' } })),
      );

      await expect(firstValueFrom(store.resend(invitation.id))).rejects.toBeInstanceOf(
        HttpErrorResponse,
      );
      expect(store.state()).toBe(before);
    },
  );

  it('clears data and cancels pending requests when the tenant changes', async () => {
    const pending = new Subject<PaginatedTeamInvitationsResponse>();
    const store = TestBed.inject(TeamInvitationsStore);
    await firstValueFrom(store.load({ page: 1, limit: 20 }));
    api.list.mockReturnValueOnce(pending.asObservable());
    store.load({ page: 2, limit: 20 }).subscribe();

    TestBed.inject(TenantResetRegistry).resetAll();
    pending.next(response());
    expect(store.state().status).toBe('idle');
    expect(store.state().data).toEqual([]);
  });
});
