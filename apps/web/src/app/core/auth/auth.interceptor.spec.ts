import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { API_BASE_URL } from '../config/api-config';
import { AccessTokenStore } from './access-token.store';
import { authInterceptor } from './auth.interceptor';
import { AuthStateService } from './auth-state.service';

describe('authInterceptor', () => {
  const authState = {
    refreshAccessToken: vi.fn(),
  };
  let http: HttpClient;
  let controller: HttpTestingController;
  let tokens: AccessTokenStore;

  beforeEach(() => {
    vi.clearAllMocks();
    authState.refreshAccessToken.mockReturnValue(of('new.jwt.token'));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://localhost:3000/api' },
        { provide: AuthStateService, useValue: authState },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    tokens = TestBed.inject(AccessTokenStore);
  });

  afterEach(() => controller.verify());

  it('adds the in-memory Bearer token only to configured API requests', async () => {
    tokens.set('current.jwt.token');
    const apiResponse = firstValueFrom(http.get('http://localhost:3000/api/auth/me'));
    const apiRequest = controller.expectOne('http://localhost:3000/api/auth/me');
    expect(apiRequest.request.headers.get('Authorization')).toBe('Bearer current.jwt.token');
    apiRequest.flush({ ok: true });
    await apiResponse;

    const externalResponse = firstValueFrom(http.get('https://example.com/data'));
    const externalRequest = controller.expectOne('https://example.com/data');
    expect(externalRequest.request.headers.has('Authorization')).toBe(false);
    externalRequest.flush({ ok: true });
    await externalResponse;
  });

  it('refreshes once and retries a protected request after 401', async () => {
    tokens.set('expired.jwt.token');
    const response = firstValueFrom(
      http.get<{ data: string }>('http://localhost:3000/api/clientes'),
    );
    const initialRequest = controller.expectOne('http://localhost:3000/api/clientes');
    initialRequest.flush(null, { status: 401, statusText: 'Unauthorized' });

    const retriedRequest = controller.expectOne('http://localhost:3000/api/clientes');
    expect(retriedRequest.request.headers.get('Authorization')).toBe('Bearer new.jwt.token');
    retriedRequest.flush({ data: 'ok' });

    await expect(response).resolves.toEqual({ data: 'ok' });
    expect(authState.refreshAccessToken).toHaveBeenCalledOnce();
  });

  it('does not refresh recursively for authentication endpoints', async () => {
    tokens.set('expired.jwt.token');
    const response = firstValueFrom(http.post('http://localhost:3000/api/auth/refresh', null));
    const request = controller.expectOne('http://localhost:3000/api/auth/refresh');
    request.flush(null, { status: 401, statusText: 'Unauthorized' });

    await expect(response).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(authState.refreshAccessToken).not.toHaveBeenCalled();
  });
});
