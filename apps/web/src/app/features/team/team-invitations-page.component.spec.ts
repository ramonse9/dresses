import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { TenantStore } from '../../core/tenant/tenant.store';
import type { TeamInvitation, TeamInvitationListState } from './team-invitation.models';
import { TeamInvitationsPageComponent } from './team-invitations-page.component';
import { TeamInvitationsStore } from './team-invitations.store';

const invitation: TeamInvitation = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'persona@example.test',
  rol: 'EMPLOYEE',
  estado: 'PENDIENTE',
  expiresAt: '2026-12-01T12:00:00.000Z',
  lastSentAt: '2026-11-22T12:00:00.000Z',
  sendCount: 2,
  createdAt: '2026-11-22T12:00:00.000Z',
};
const loadedState: TeamInvitationListState = {
  status: 'loaded',
  data: [invitation],
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  filters: { page: 1, limit: 20 },
  error: null,
};

describe('TeamInvitationsPageComponent', () => {
  const queryParamMap = new BehaviorSubject(convertToParamMap({}));
  const state = signal<TeamInvitationListState>(loadedState);
  const role = signal<'OWNER' | 'EMPLOYEE'>('OWNER');
  const store = {
    state: state.asReadonly(),
    load: vi.fn(() => of(undefined)),
    create: vi.fn(() => of(undefined)),
    resend: vi.fn(() => of(undefined)),
    revoke: vi.fn(() => of(undefined)),
  };
  const route = {
    queryParamMap: queryParamMap.asObservable(),
    snapshot: { queryParamMap: queryParamMap.value },
  };
  let fixture: ComponentFixture<TeamInvitationsPageComponent>;

  beforeEach(async () => {
    store.load.mockReset().mockReturnValue(of(undefined));
    store.create.mockReset().mockReturnValue(of(undefined));
    store.resend.mockReset().mockReturnValue(of(undefined));
    store.revoke.mockReset().mockReturnValue(of(undefined));
    queryParamMap.next(convertToParamMap({}));
    state.set(loadedState);
    role.set('OWNER');
    TestBed.configureTestingModule({
      imports: [TeamInvitationsPageComponent],
      providers: [
        provideRouter([]),
        { provide: TeamInvitationsStore, useValue: store },
        { provide: TenantStore, useValue: { role: role.asReadonly() } },
        { provide: ActivatedRoute, useValue: route },
      ],
    });
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(TeamInvitationsPageComponent);
    fixture.detectChanges();
  });

  it('renders safe invitation data and all derived states', () => {
    state.set({
      ...loadedState,
      data: [
        invitation,
        { ...invitation, id: '2', estado: 'EXPIRADA' },
        { ...invitation, id: '3', estado: 'ACEPTADA' },
        { ...invitation, id: '4', estado: 'REVOCADA' },
      ],
      pagination: { ...loadedState.pagination, total: 4 },
    });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('persona@example.test');
    expect(text).toContain('PENDIENTE');
    expect(text).toContain('EXPIRADA');
    expect(text).toContain('ACEPTADA');
    expect(text).toContain('REVOCADA');
    expect(text).toContain('Último envío');
    expect(text).toContain('Envíos');
    expect(text).not.toMatch(/tokenHash|schemaName|tenant_/);
  });

  it('normalizes email, preserves the selected role and avoids duplicate submission', () => {
    const pending = new Subject<undefined>();
    store.create.mockReturnValueOnce(pending.asObservable());
    const component = fixture.componentInstance;
    component.createForm.setValue({ email: '  PERSONA@EXAMPLE.TEST ', rol: 'OWNER' });

    component.createInvitation();
    component.createInvitation();
    expect(store.create).toHaveBeenCalledTimes(1);
    expect(store.create).toHaveBeenCalledWith({
      email: 'persona@example.test',
      rol: 'OWNER',
    });
    expect(component.createSubmitting()).toBe(true);
    pending.next(undefined);
    pending.complete();
    expect(component.createSubmitting()).toBe(false);
  });

  it('requires confirmation before resend and revoke', () => {
    const component = fixture.componentInstance;
    component.requestResend(invitation);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('enlace anterior quedará invalidado');
    component.confirmAction();
    expect(store.resend).toHaveBeenCalledWith(invitation.id);

    component.requestRevoke(invitation);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('ya no podrá utilizar esta invitación');
    component.confirmAction();
    expect(store.revoke).toHaveBeenCalledWith(invitation.id);
  });

  it.each([
    [409, 'membresía activa o una invitación pendiente'],
    [429, 'esperar'],
    [503, 'correo no pudo enviarse'],
  ])('shows a controlled mutation error for status %s', (status, expected) => {
    store.create.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status, error: { message: 'Internal detail' } })),
    );
    const component = fixture.componentInstance;
    component.createForm.setValue({ email: 'persona@example.test', rol: 'EMPLOYEE' });
    component.createInvitation();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(expected);
    expect(fixture.nativeElement.textContent).not.toContain('Internal detail');
    if (status === 503) {
      expect(store.load).toHaveBeenCalledWith(loadedState.filters);
    }
  });

  it('hides invitation controls for EMPLOYEE and preserves a forced 403', () => {
    role.set('EMPLOYEE');
    state.set({
      ...loadedState,
      status: 'error',
      data: [],
      error: { status: 403, message: 'Internal forbidden detail' },
    });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).not.toContain('Nueva invitación');
    expect(text).not.toContain('Filtros de invitaciones');
    expect(text).not.toContain('Reenviar');
    expect(text).not.toContain('Revocar');
    expect(text).toContain('No tienes autorización');
    expect(text).not.toContain('Internal forbidden detail');
  });
});
