import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import { TenantResetRegistry } from '../../core/tenant/tenant-reset-registry.service';
import { TeamApiService } from './team-api.service';
import type { PaginatedTeamMembersResponse, TeamMember } from './team.models';
import { TeamStore } from './team.store';

const member: TeamMember = {
  id: 'member-1',
  usuario: {
    id: 'user-1',
    nombre: 'Ana López',
    email: 'ana@example.test',
    activo: true,
  },
  rol: 'OWNER',
  activo: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

function response(data: readonly TeamMember[] = [member]): PaginatedTeamMembersResponse {
  return {
    data,
    pagination: { page: 1, limit: 20, total: data.length, totalPages: data.length ? 1 : 0 },
  };
}

describe('TeamStore', () => {
  const api = {
    list: vi.fn(),
    getById: vi.fn(),
    updateRole: vi.fn(),
    updateStatus: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.list.mockReturnValue(of(response()));
    api.getById.mockReturnValue(of(member));
    api.updateRole.mockReturnValue(of(member));
    api.updateStatus.mockReturnValue(of(member));
    TestBed.configureTestingModule({
      providers: [TeamStore, TenantResetRegistry, { provide: TeamApiService, useValue: api }],
    });
  });

  it('loads list and detail without exposing schemas', async () => {
    const store = TestBed.inject(TeamStore);
    await firstValueFrom(
      store.loadList({ page: 1, limit: 20, rol: 'OWNER', activo: true, q: 'Ana' }),
    );
    await firstValueFrom(store.loadDetail(member.id));

    expect(store.listState()).toMatchObject({ status: 'loaded', data: [member] });
    expect(store.detailState()).toEqual({ status: 'loaded', data: member, error: null });
    expect(JSON.stringify(store.detailState())).not.toMatch(/schemaName|tenant_/);
  });

  it('ignores obsolete list responses', () => {
    const oldResponse = new Subject<PaginatedTeamMembersResponse>();
    const newResponse = new Subject<PaginatedTeamMembersResponse>();
    api.list
      .mockReturnValueOnce(oldResponse.asObservable())
      .mockReturnValueOnce(newResponse.asObservable());
    const store = TestBed.inject(TeamStore);
    const newer = { ...member, id: 'member-2', usuario: { ...member.usuario, nombre: 'Bea' } };
    store.loadList({ page: 1, limit: 20, q: 'Ana' }).subscribe();
    store.loadList({ page: 1, limit: 20, q: 'Bea' }).subscribe();

    newResponse.next(response([newer]));
    oldResponse.next(response([member]));

    expect(store.listState().data).toEqual([newer]);
    expect(store.listState().filters.q).toBe('Bea');
  });

  it('reloads authoritative detail after role and status mutations', async () => {
    const employee = { ...member, rol: 'EMPLOYEE' as const };
    const inactive = { ...employee, activo: false };
    api.updateRole.mockReturnValueOnce(of(employee));
    api.getById.mockReturnValueOnce(of(member)).mockReturnValueOnce(of(employee));
    const store = TestBed.inject(TeamStore);
    await firstValueFrom(store.loadDetail(member.id));
    await firstValueFrom(store.changeRole(member.id, 'EMPLOYEE'));
    expect(store.detailState().data).toEqual(employee);
    expect(api.getById).toHaveBeenCalledTimes(2);

    api.updateStatus.mockReturnValueOnce(of(inactive));
    api.getById.mockReturnValueOnce(of(inactive));
    await firstValueFrom(store.changeStatus(member.id, false));
    expect(store.detailState().data).toEqual(inactive);
  });

  it.each([403, 404, 409])(
    'keeps local state unchanged after mutation status %s',
    async (status) => {
      api.updateStatus.mockReturnValueOnce(
        throwError(() => new HttpErrorResponse({ status, error: { message: 'Rejected' } })),
      );
      const store = TestBed.inject(TeamStore);
      await firstValueFrom(store.loadList({ page: 1, limit: 20 }));
      await firstValueFrom(store.loadDetail(member.id));
      const listBefore = store.listState();
      const detailBefore = store.detailState();

      await expect(firstValueFrom(store.changeStatus(member.id, false))).rejects.toBeInstanceOf(
        HttpErrorResponse,
      );
      expect(store.listState()).toBe(listBefore);
      expect(store.detailState()).toBe(detailBefore);
    },
  );

  it('preserves 403 and 404 load errors for distinct UI handling', async () => {
    api.list.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 403, error: { message: 'Forbidden' } })),
    );
    api.getById.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 404, error: { message: 'Not found' } })),
    );
    const store = TestBed.inject(TeamStore);
    await firstValueFrom(store.loadList({ page: 1, limit: 20 }));
    await firstValueFrom(store.loadDetail('cross-tenant'));

    expect(store.listState().error?.status).toBe(403);
    expect(store.detailState().error?.status).toBe(404);
  });

  it('clears list, detail and pending requests through TenantResetRegistry', async () => {
    const pending = new Subject<PaginatedTeamMembersResponse>();
    api.list.mockReturnValueOnce(pending.asObservable());
    const store = TestBed.inject(TeamStore);
    const registry = TestBed.inject(TenantResetRegistry);
    await firstValueFrom(store.loadDetail(member.id));
    store.loadList({ page: 2, limit: 20 }).subscribe();

    registry.resetAll();
    pending.next(response());

    expect(store.listState().status).toBe('idle');
    expect(store.detailState()).toEqual({ status: 'idle', data: null, error: null });
  });
});
