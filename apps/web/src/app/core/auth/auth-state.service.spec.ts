import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import { AccessTokenStore } from './access-token.store';
import { AuthApiService } from './auth-api.service';
import type { AccessTokenResponse, AuthenticatedUser } from './auth.models';
import { AuthStateService } from './auth-state.service';

describe('AuthStateService', () => {
  const accessResponse: AccessTokenResponse = {
    accessToken: 'signed.jwt.token',
    tokenType: 'Bearer',
    expiresIn: 900,
  };
  const user: AuthenticatedUser = {
    sub: '019a6f33-82b7-7a22-971b-6a8d7c5e4f30',
    email: 'owner@example.com',
    sessionId: '47ecf96a-8f2c-4e07-bd1f-93936f2cdb90',
  };
  const api = {
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
  };

  let service: AuthStateService;
  let tokens: AccessTokenStore;

  beforeEach(() => {
    vi.clearAllMocks();
    api.login.mockReturnValue(of(accessResponse));
    api.refresh.mockReturnValue(of(accessResponse));
    api.logout.mockReturnValue(of(undefined));
    api.me.mockReturnValue(of(user));

    TestBed.configureTestingModule({
      providers: [AuthStateService, AccessTokenStore, { provide: AuthApiService, useValue: api }],
    });
    service = TestBed.inject(AuthStateService);
    tokens = TestBed.inject(AccessTokenStore);
  });

  it('authenticates, stores the access token only in memory and loads the profile', async () => {
    await expect(
      firstValueFrom(service.login({ email: user.email, password: 'correct-password' })),
    ).resolves.toEqual(user);

    expect(tokens.token()).toBe(accessResponse.accessToken);
    expect(service.user()).toEqual(user);
    expect(service.status()).toBe('authenticated');
    expect(service.isAuthenticated()).toBe(true);
  });

  it('restores a session from the HttpOnly cookie without exposing a startup 401', async () => {
    await firstValueFrom(service.restoreSession());
    expect(service.status()).toBe('authenticated');

    api.refresh.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 401 })));
    await firstValueFrom(service.restoreSession());

    expect(service.status()).toBe('anonymous');
    expect(service.user()).toBeNull();
    expect(service.error()).toBeNull();
    expect(tokens.token()).toBeNull();
  });

  it('shares one refresh request between concurrent consumers', async () => {
    const refreshResponse = new Subject<AccessTokenResponse>();
    api.refresh.mockReturnValue(refreshResponse);

    const first = firstValueFrom(service.refreshAccessToken());
    const second = firstValueFrom(service.refreshAccessToken());

    expect(api.refresh).toHaveBeenCalledOnce();
    refreshResponse.next(accessResponse);
    refreshResponse.complete();

    await expect(Promise.all([first, second])).resolves.toEqual([
      accessResponse.accessToken,
      accessResponse.accessToken,
    ]);
    expect(api.me).toHaveBeenCalledOnce();
  });

  it('clears all local auth state after logout even when the request fails', async () => {
    await firstValueFrom(service.login({ email: user.email, password: 'password' }));
    api.logout.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));

    await expect(firstValueFrom(service.logout())).rejects.toBeInstanceOf(HttpErrorResponse);

    expect(service.status()).toBe('anonymous');
    expect(service.user()).toBeNull();
    expect(tokens.token()).toBeNull();
  });

  it('normalizes login errors for future UI consumers', async () => {
    api.login.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 401,
            error: { message: 'Credenciales inválidas' },
          }),
      ),
    );

    await expect(
      firstValueFrom(service.login({ email: user.email, password: 'wrong' })),
    ).rejects.toBeInstanceOf(HttpErrorResponse);

    expect(service.error()).toMatchObject({
      status: 401,
      message: 'Credenciales inválidas',
    });
    expect(service.status()).toBe('anonymous');
  });
});
