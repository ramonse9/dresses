import { HttpErrorResponse } from '@angular/common/http';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import type { AccountSession } from './account-session.models';
import { AccountSessionsApiService } from './account-sessions-api.service';
import { AccountSessionsPageComponent } from './account-sessions-page.component';
import { CurrentSessionCleanupService } from './current-session-cleanup.service';

const current: AccountSession = {
  id: '88888888-8888-4888-8888-888888888888',
  current: true,
  createdAt: '2026-11-20T12:00:00.000Z',
  lastSeenAt: '2026-11-23T12:00:00.000Z',
  expiresAt: '2027-01-20T12:00:00.000Z',
  revokedAt: null,
  ipAddress: '203.0.113.10',
  userAgent: 'Test Browser/1.0',
};
const remote: AccountSession = {
  ...current,
  id: '99999999-9999-4999-8999-999999999999',
  current: false,
  ipAddress: null,
  userAgent: null,
};

describe('AccountSessionsPageComponent', () => {
  const api = {
    list: vi.fn(),
    revoke: vi.fn(),
    revokeOthers: vi.fn(),
  };
  const cleanup = { cleanupAndNavigateToLogin: vi.fn() };
  let fixture: ComponentFixture<AccountSessionsPageComponent>;

  beforeEach(async () => {
    vi.clearAllMocks();
    api.list.mockReturnValue(of([current, remote]));
    api.revoke.mockReturnValue(of(undefined));
    api.revokeOthers.mockReturnValue(of({ revokedCount: 1 }));
    TestBed.configureTestingModule({
      imports: [AccountSessionsPageComponent],
      providers: [
        { provide: AccountSessionsApiService, useValue: api },
        { provide: CurrentSessionCleanupService, useValue: cleanup },
      ],
    });
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(AccountSessionsPageComponent);
    fixture.detectChanges();
  });

  it('renders the safe session list, current indicator and accessible landmarks', () => {
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Test Browser/1.0');
    expect(text).toContain('203.0.113.10');
    expect(text).toContain('Dispositivo desconocido');
    expect(text).toContain('Esta sesión');
    expect(text).toContain('Última actividad');
    expect(fixture.nativeElement.querySelector('h1#sessions-title')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('time[datetime]')).toHaveLength(6);
    expect(text).not.toMatch(/refreshToken|tokenHash|schemaName|tenant_/);
  });

  it('confirms and revokes a remote session without cleaning the current session', () => {
    const component = fixture.componentInstance;
    component.requestSessionRevocation(remote);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();

    component.confirmRevocation();
    fixture.detectChanges();

    expect(api.revoke).toHaveBeenCalledWith(remote.id);
    expect(api.list).toHaveBeenCalledTimes(2);
    expect(cleanup.cleanupAndNavigateToLogin).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('La sesión remota fue revocada.');
  });

  it('revokes every other session and reloads the authoritative list', () => {
    const component = fixture.componentInstance;
    component.requestOtherSessionsRevocation();
    component.confirmRevocation();
    fixture.detectChanges();

    expect(api.revokeOthers).toHaveBeenCalledOnce();
    expect(api.list).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('Se revocaron 1 sesiones adicionales.');
  });

  it('revokes the current session and performs complete cleanup', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const component = fixture.componentInstance;
    component.requestSessionRevocation(current);
    component.confirmRevocation();

    expect(api.revoke).toHaveBeenCalledWith(current.id);
    expect(cleanup.cleanupAndNavigateToLogin).toHaveBeenCalledOnce();
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  it('distinguishes an unavailable foreign session from a network error', () => {
    api.revoke.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 404, statusText: 'Not Found' })),
    );
    const component = fixture.componentInstance;
    component.requestSessionRevocation(remote);
    component.confirmRevocation();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'La sesión ya no está disponible o no te pertenece.',
    );
    expect(cleanup.cleanupAndNavigateToLogin).not.toHaveBeenCalled();
  });

  it('cleans the local session when the API responds 401', () => {
    api.list.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' })),
    );
    const component = fixture.componentInstance;
    component.load();

    expect(cleanup.cleanupAndNavigateToLogin).toHaveBeenCalledOnce();
  });
});
