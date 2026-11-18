import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, NEVER, of, Subject, throwError } from 'rxjs';
import { AccessTokenStore } from './access-token.store';
import { AuthApiService } from './auth-api.service';
import type { AccessTokenResponse, AuthenticatedUser } from './auth.models';
import { AUTH_INITIALIZATION_TIMEOUT_MS, AuthStore } from './auth.store';

describe('AuthStore', () => {
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

  let store: AuthStore;

  beforeEach(() => {
    vi.clearAllMocks();
    api.login.mockReturnValue(of(accessResponse));
    api.refresh.mockReturnValue(of(accessResponse));
    api.logout.mockReturnValue(of(undefined));
    api.me.mockReturnValue(of(user));

    TestBed.configureTestingModule({
      providers: [
        AuthStore,
        AccessTokenStore,
        { provide: AuthApiService, useValue: api },
        { provide: AUTH_INITIALIZATION_TIMEOUT_MS, useValue: 20 },
      ],
    });
    store = TestBed.inject(AuthStore);
  });

  afterEach(() => vi.restoreAllMocks());

  it('starts in the initializing state without identity, token or expiration', () => {
    expect(store.session()).toEqual({
      status: 'initializing',
      user: null,
      accessTokenExpiresAt: null,
      initializationError: null,
    });
    expect(store.getAccessToken()).toBeNull();
  });

  it('initializes an authenticated session and tracks access token expiration', async () => {
    const now = 1_800_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);

    await firstValueFrom(store.initialize());

    expect(store.status()).toBe('authenticated');
    expect(store.user()).toEqual(user);
    expect(store.getAccessToken()).toBe(accessResponse.accessToken);
    expect(store.accessTokenExpiresAt()).toBe(now + accessResponse.expiresIn * 1_000);
    expect(store.initializationError()).toBeNull();
  });

  it('becomes anonymous without an initialization error after 401', async () => {
    api.refresh.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 401 })));

    await firstValueFrom(store.initialize());

    expect(store.status()).toBe('anonymous');
    expect(store.initializationError()).toBeNull();
    expect(store.getAccessToken()).toBeNull();
  });

  it('captures a network error as an optional initialization error', async () => {
    api.refresh.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 0,
            error: new ProgressEvent('error'),
          }),
      ),
    );

    await firstValueFrom(store.initialize());

    expect(store.status()).toBe('anonymous');
    expect(store.initializationError()).toMatchObject({
      status: 0,
      message: 'No fue posible conectar con el servidor.',
    });
  });

  it('does not block initialization indefinitely', async () => {
    api.refresh.mockReturnValueOnce(NEVER);

    await firstValueFrom(store.initialize());

    expect(store.status()).toBe('anonymous');
    expect(store.initializationError()).toMatchObject({ status: 0 });
    expect(store.getAccessToken()).toBeNull();
  });

  it('deduplicates concurrent initialization calls', async () => {
    const refreshResponse = new Subject<AccessTokenResponse>();
    api.refresh.mockReturnValue(refreshResponse);

    const firstInitialization = store.initialize();
    const secondInitialization = store.initialize();
    const first = firstValueFrom(firstInitialization);
    const second = firstValueFrom(secondInitialization);

    expect(secondInitialization).toBe(firstInitialization);
    expect(api.refresh).toHaveBeenCalledOnce();
    refreshResponse.next(accessResponse);
    refreshResponse.complete();

    await Promise.all([first, second]);
    expect(api.me).toHaveBeenCalledOnce();
  });

  it('shares one refresh and clears the session when refresh fails', async () => {
    const refreshResponse = new Subject<AccessTokenResponse>();
    api.refresh.mockReturnValueOnce(refreshResponse);

    const first = firstValueFrom(store.refreshAccessToken());
    const second = firstValueFrom(store.refreshAccessToken());
    expect(api.refresh).toHaveBeenCalledOnce();

    refreshResponse.next(accessResponse);
    refreshResponse.complete();
    await expect(Promise.all([first, second])).resolves.toEqual([
      accessResponse.accessToken,
      accessResponse.accessToken,
    ]);

    api.refresh.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 401 })));
    await expect(firstValueFrom(store.refreshAccessToken())).rejects.toBeInstanceOf(
      HttpErrorResponse,
    );
    expect(store.status()).toBe('anonymous');
    expect(store.getAccessToken()).toBeNull();
  });

  it('sets and completely clears an in-memory session', () => {
    store.setAuthenticatedSession(accessResponse, user);
    expect(store.getAccessToken()).toBe(accessResponse.accessToken);
    expect(store.isAuthenticated()).toBe(true);

    store.clearSession();

    expect(store.session()).toEqual({
      status: 'anonymous',
      user: null,
      accessTokenExpiresAt: null,
      initializationError: null,
    });
    expect(store.getAccessToken()).toBeNull();
  });

  it('uses the API layer for login and clears local state after failed logout', async () => {
    await firstValueFrom(store.login({ email: user.email, password: 'correct-password' }));
    expect(store.status()).toBe('authenticated');

    api.logout.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
    await expect(firstValueFrom(store.logout())).rejects.toBeInstanceOf(HttpErrorResponse);

    expect(store.status()).toBe('anonymous');
    expect(store.getAccessToken()).toBeNull();
  });
});
