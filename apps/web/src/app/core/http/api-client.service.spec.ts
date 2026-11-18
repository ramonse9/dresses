import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../config/api-config';
import { ApiClient } from './api-client.service';

describe('ApiClient', () => {
  let client: ApiClient;
  let httpController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://localhost:3000/api/' },
      ],
    });
    client = TestBed.inject(ApiClient);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpController.verify());

  it('builds relative API URLs and query parameters', async () => {
    const response = firstValueFrom(
      client.get<{ data: string[] }>('/vestidos/', {
        params: { page: 2, activo: true, omitido: undefined },
      }),
    );
    const request = httpController.expectOne(
      'http://localhost:3000/api/vestidos?page=2&activo=true',
    );

    expect(request.request.method).toBe('GET');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ data: ['V-001'] });
    await expect(response).resolves.toEqual({ data: ['V-001'] });
  });

  it('supports POST, PATCH and DELETE with generic responses', async () => {
    const created = firstValueFrom(
      client.post<{ id: string }, { nombre: string }>('clientes', {
        nombre: 'Ana',
      }),
    );
    const post = httpController.expectOne('http://localhost:3000/api/clientes');
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ nombre: 'Ana' });
    post.flush({ id: 'cliente-1' });
    await expect(created).resolves.toEqual({ id: 'cliente-1' });

    const updated = firstValueFrom(
      client.patch<{ activo: boolean }, { activo: boolean }>('clientes/cliente-1', {
        activo: false,
      }),
    );
    const patch = httpController.expectOne('http://localhost:3000/api/clientes/cliente-1');
    expect(patch.request.method).toBe('PATCH');
    patch.flush({ activo: false });
    await expect(updated).resolves.toEqual({ activo: false });

    const deleted = firstValueFrom(client.delete<void>('clientes/cliente-1'));
    const remove = httpController.expectOne('http://localhost:3000/api/clientes/cliente-1');
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null);
    await expect(deleted).resolves.toBeNull();
  });

  it('passes credential mode explicitly when requested', async () => {
    const response = firstValueFrom(
      client.post<{ accessToken: string }, null>('auth/refresh', null, {
        withCredentials: true,
      }),
    );
    const request = httpController.expectOne('http://localhost:3000/api/auth/refresh');

    expect(request.request.withCredentials).toBe(true);
    expect(request.request.body).toBeNull();
    request.flush({ accessToken: 'signed.jwt.token' });
    await expect(response).resolves.toEqual({ accessToken: 'signed.jwt.token' });
  });

  it('rejects absolute URLs and schema selectors', () => {
    expect(() => client.get('https://example.com/api')).toThrow('La ruta del API no es válida.');
    expect(() => client.get('tenant_019a6f3382b77a22971b6a8d7c5e4f30/vestidos')).toThrow(
      'La ruta del API no es válida.',
    );
    expect(() => client.get('vestidos', { params: { schemaName: 'tenant_untrusted' } })).toThrow(
      'schemaName no es un parámetro permitido.',
    );
  });
});
