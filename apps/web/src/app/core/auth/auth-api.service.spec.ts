import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import { AuthApiService } from './auth-api.service';

describe('AuthApiService', () => {
  const api = {
    get: vi.fn(),
    post: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockReturnValue(of({}));
    api.post.mockReturnValue(of({}));
    TestBed.configureTestingModule({
      providers: [AuthApiService, { provide: ApiClient, useValue: api }],
    });
  });

  it('uses credentialed requests only for cookie-based auth operations', () => {
    const service = TestBed.inject(AuthApiService);
    const credentials = { email: 'owner@example.com', password: 'secret' };

    service.login(credentials).subscribe();
    service.refresh().subscribe();
    service.logout().subscribe();
    service.me().subscribe();

    expect(api.post).toHaveBeenNthCalledWith(1, 'auth/login', credentials, {
      withCredentials: true,
    });
    expect(api.post).toHaveBeenNthCalledWith(2, 'auth/refresh', null, {
      withCredentials: true,
    });
    expect(api.post).toHaveBeenNthCalledWith(3, 'auth/logout', null, {
      withCredentials: true,
    });
    expect(api.get).toHaveBeenCalledWith('auth/me', {
      withCredentials: true,
    });
  });
});
