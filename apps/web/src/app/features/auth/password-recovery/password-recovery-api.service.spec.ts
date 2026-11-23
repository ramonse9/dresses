import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { ApiClient } from '../../../core/http/api-client.service';
import { PasswordRecoveryApiService } from './password-recovery-api.service';

describe('PasswordRecoveryApiService', () => {
  const api = { post: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.post.mockReturnValue(
      of({
        message: 'Respuesta pública genérica',
        token: 'must-not-survive',
        schemaName: 'tenant_must_not_survive',
      }),
    );
    TestBed.configureTestingModule({
      providers: [PasswordRecoveryApiService, { provide: ApiClient, useValue: api }],
    });
  });

  it('requests recovery with only the normalized email supplied by the page', async () => {
    const result = await firstValueFrom(
      TestBed.inject(PasswordRecoveryApiService).request({ email: 'person@example.test' }),
    );

    expect(api.post).toHaveBeenCalledWith('auth/password/solicitar', {
      email: 'person@example.test',
    });
    expect(result).toEqual({ message: 'Respuesta pública genérica' });
    expect(JSON.stringify(result)).not.toMatch(/token|schemaName|tenant_/);
  });

  it('resets with only the token and password', async () => {
    const result = await firstValueFrom(
      TestBed.inject(PasswordRecoveryApiService).reset({
        token: 'opaque-token',
        password: 'new-secure-password',
      }),
    );

    expect(api.post).toHaveBeenCalledWith('auth/password/restablecer', {
      token: 'opaque-token',
      password: 'new-secure-password',
    });
    expect(JSON.stringify(api.post.mock.calls)).not.toMatch(
      /passwordConfirmation|empresaId|schemaName|rol/,
    );
    expect(result).toEqual({ message: 'Respuesta pública genérica' });
  });
});
