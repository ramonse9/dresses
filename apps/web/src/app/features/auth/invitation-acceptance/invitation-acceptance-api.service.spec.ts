import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { ApiClient } from '../../../core/http/api-client.service';
import { InvitationAcceptanceApiService } from './invitation-acceptance-api.service';

describe('InvitationAcceptanceApiService', () => {
  const api = { post: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.post.mockImplementation((path: string) =>
      path.endsWith('/verificar')
        ? of({
            empresaNombre: 'Atelier Norte',
            email: 'p***@example.test',
            rol: 'EMPLOYEE',
            expiresAt: '2026-12-01T12:00:00.000Z',
            accountExists: false,
            schemaName: 'tenant_must_not_survive',
            tokenHash: 'must-not-survive',
          })
        : of({ accepted: true, message: 'Invitación aceptada', token: 'must-not-survive' }),
    );
    TestBed.configureTestingModule({
      providers: [InvitationAcceptanceApiService, { provide: ApiClient, useValue: api }],
    });
  });

  it('verifies using only the opaque token and projects a safe response', async () => {
    const result = await firstValueFrom(
      TestBed.inject(InvitationAcceptanceApiService).verify('opaque-token'),
    );

    expect(api.post).toHaveBeenCalledWith('auth/invitaciones/verificar', {
      token: 'opaque-token',
    });
    expect(result).toEqual({
      empresaNombre: 'Atelier Norte',
      email: 'p***@example.test',
      rol: 'EMPLOYEE',
      expiresAt: '2026-12-01T12:00:00.000Z',
      accountExists: false,
    });
    expect(JSON.stringify(result)).not.toMatch(/token|tokenHash|schemaName|tenant_/);
  });

  it('accepts without password confirmation, role or company selectors', async () => {
    const result = await firstValueFrom(
      TestBed.inject(InvitationAcceptanceApiService).accept({
        token: 'opaque-token',
        nombre: 'Ana López',
        password: 'secure-password',
      }),
    );

    expect(api.post).toHaveBeenCalledWith('auth/invitaciones/aceptar', {
      token: 'opaque-token',
      nombre: 'Ana López',
      password: 'secure-password',
    });
    expect(result).toEqual({ accepted: true, message: 'Invitación aceptada' });
    expect(JSON.stringify(api.post.mock.calls)).not.toMatch(
      /passwordConfirmation|schemaName|empresaId|empresaSlug|rol/,
    );
  });
});
