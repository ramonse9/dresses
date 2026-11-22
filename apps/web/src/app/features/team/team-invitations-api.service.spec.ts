import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { ApiClient } from '../../core/http/api-client.service';
import type { TeamInvitation } from './team-invitation.models';
import { TeamInvitationsApiService } from './team-invitations-api.service';

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

describe('TeamInvitationsApiService', () => {
  const unsafeWire = {
    ...invitation,
    token: 'must-not-survive',
    tokenHash: 'must-not-survive',
    schemaName: 'tenant_must_not_survive',
  };
  const api = {
    get: vi.fn(() =>
      of({
        data: [unsafeWire],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    ),
    post: vi.fn(() => of(unsafeWire)),
    delete: vi.fn(() => of(unsafeWire)),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [TeamInvitationsApiService, { provide: ApiClient, useValue: api }],
    });
  });

  it('lists with filters and projects only safe visual fields', async () => {
    const result = await firstValueFrom(
      TestBed.inject(TeamInvitationsApiService).list({
        page: 2,
        limit: 50,
        estado: 'PENDIENTE',
        rol: 'EMPLOYEE',
        q: 'persona',
      }),
    );

    expect(api.get).toHaveBeenCalledWith('equipo/invitaciones', {
      params: {
        page: 2,
        limit: 50,
        estado: 'PENDIENTE',
        rol: 'EMPLOYEE',
        q: 'persona',
      },
    });
    expect(result.data).toEqual([invitation]);
    expect(JSON.stringify(result)).not.toMatch(/token|tokenHash|schemaName|tenant_/);
  });

  it('creates, resends and revokes without tenant selectors', async () => {
    const service = TestBed.inject(TeamInvitationsApiService);
    await firstValueFrom(service.create({ email: invitation.email, rol: 'OWNER' }));
    await firstValueFrom(service.resend('invitation/id'));
    await firstValueFrom(service.revoke('invitation/id'));

    expect(api.post).toHaveBeenCalledWith('equipo/invitaciones', {
      email: invitation.email,
      rol: 'OWNER',
    });
    expect(api.post).toHaveBeenCalledWith('equipo/invitaciones/invitation%2Fid/reenviar', {});
    expect(api.delete).toHaveBeenCalledWith('equipo/invitaciones/invitation%2Fid');
    expect(JSON.stringify([...api.post.mock.calls, ...api.delete.mock.calls])).not.toMatch(
      /empresaId|empresaSlug|schemaName/,
    );
  });
});
