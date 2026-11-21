import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { AuthStore } from '../../core/auth/auth.store';
import { TenantStore } from '../../core/tenant/tenant.store';
import { TeamDetailPageComponent } from './team-detail-page.component';
import type { TeamDetailState, TeamMember } from './team.models';
import { TeamStore } from './team.store';

const member: TeamMember = {
  id: '11111111-1111-4111-8111-111111111111',
  usuario: {
    id: '22222222-2222-4222-8222-222222222222',
    nombre: 'Ana López',
    email: 'ana@example.test',
    activo: true,
  },
  rol: 'OWNER',
  activo: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('TeamDetailPageComponent', () => {
  const detailState = signal<TeamDetailState>({ status: 'loaded', data: member, error: null });
  const role = signal<'OWNER' | 'EMPLOYEE' | null>('OWNER');
  const user = signal({ sub: 'different-user', email: 'owner@example.test', sessionId: 'session' });
  const store = {
    detailState: detailState.asReadonly(),
    loadDetail: vi.fn(() => of(undefined)),
    changeRole: vi.fn(() => of({ ...member, rol: 'EMPLOYEE' as const })),
    changeStatus: vi.fn(() => of({ ...member, activo: false })),
  };
  const route = {
    paramMap: of(convertToParamMap({ id: member.id })),
    snapshot: {
      paramMap: convertToParamMap({ id: member.id }),
      queryParamMap: convertToParamMap({ page: '2', rol: 'OWNER' }),
    },
  };
  let fixture: ComponentFixture<TeamDetailPageComponent>;

  beforeEach(async () => {
    vi.clearAllMocks();
    detailState.set({ status: 'loaded', data: member, error: null });
    role.set('OWNER');
    user.set({ sub: 'different-user', email: 'owner@example.test', sessionId: 'session' });
    store.loadDetail.mockReturnValue(of(undefined));
    store.changeRole.mockReturnValue(of({ ...member, rol: 'EMPLOYEE' }));
    store.changeStatus.mockReturnValue(of({ ...member, activo: false }));
    TestBed.configureTestingModule({
      imports: [TeamDetailPageComponent],
      providers: [
        provideRouter([]),
        { provide: TeamStore, useValue: store },
        { provide: ActivatedRoute, useValue: route },
        { provide: AuthStore, useValue: { user: user.asReadonly() } },
        { provide: TenantStore, useValue: { role: role.asReadonly() } },
      ],
    });
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(TeamDetailPageComponent);
    fixture.detectChanges();
  });

  it('renders complete detail without schema information', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Ana López');
    expect(text).toContain('ana@example.test');
    expect(text).toContain('Usuario global');
    expect(JSON.stringify(detailState())).not.toMatch(/schemaName|tenant_/);
  });

  it('requires confirmation before degrading an OWNER', () => {
    fixture.componentInstance.roleControl.setValue('EMPLOYEE');
    fixture.componentInstance.requestRoleChange();

    expect(fixture.componentInstance.pendingAction()).toEqual({
      kind: 'role',
      role: 'EMPLOYEE',
    });
    expect(store.changeRole).not.toHaveBeenCalled();
    fixture.componentInstance.confirmAction();
    expect(store.changeRole).toHaveBeenCalledWith(member.id, 'EMPLOYEE');
  });

  it('requires confirmation before deactivation and explains its scope', () => {
    fixture.componentInstance.requestStatusChange();
    fixture.detectChanges();

    expect(fixture.componentInstance.pendingAction()).toEqual({ kind: 'status', active: false });
    expect(fixture.nativeElement.textContent).toContain('únicamente a la empresa actual');
    fixture.componentInstance.confirmAction();
    expect(store.changeStatus).toHaveBeenCalledWith(member.id, false);
  });

  it('requires confirmation when modifying the current membership', () => {
    user.set({ ...user(), sub: member.usuario.id });
    fixture.componentInstance.roleControl.setValue('EMPLOYEE');
    fixture.componentInstance.requestRoleChange();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Modificar tu propia membresía');
  });

  it('promotes an EMPLOYEE directly and reload is delegated to the store', () => {
    detailState.set({ status: 'loaded', data: { ...member, rol: 'EMPLOYEE' }, error: null });
    fixture.componentInstance.roleControl.setValue('OWNER');
    fixture.componentInstance.requestRoleChange();
    expect(store.changeRole).toHaveBeenCalledWith(member.id, 'OWNER');
  });

  it('prevents a duplicate submission while a mutation is pending', () => {
    const pending = new Subject<TeamMember>();
    store.changeStatus.mockReturnValueOnce(pending.asObservable());
    fixture.componentInstance.requestStatusChange();
    fixture.componentInstance.confirmAction();
    fixture.componentInstance.confirmAction();

    expect(store.changeStatus).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.submitting()).toBe(true);
    pending.next({ ...member, activo: false });
    pending.complete();
    expect(fixture.componentInstance.submitting()).toBe(false);
  });

  it.each([
    [403, 'No tienes autorización vigente'],
    [409, 'conservar al menos un propietario activo'],
  ] as const)(
    'shows a specific mutation error for %s without changing detail',
    (status, message) => {
      store.changeStatus.mockReturnValueOnce(
        throwError(() => new HttpErrorResponse({ status, error: { message: 'Rejected' } })),
      );
      const before = detailState();
      fixture.componentInstance.requestStatusChange();
      fixture.componentInstance.confirmAction();
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain(message);
      expect(detailState()).toBe(before);
    },
  );

  it('renders a cross-tenant 404 separately from authorization', () => {
    detailState.set({ status: 'error', data: null, error: { status: 404, message: '' } });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('pertenece a otra empresa');
    expect(fixture.nativeElement.textContent).not.toContain('No tienes autorización');
  });

  it('hides administrative controls for EMPLOYEE', () => {
    role.set('EMPLOYEE');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#member-role')).toBeNull();
  });
});
