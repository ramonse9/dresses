import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { type Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api-config';

export type ApiQueryValue = string | number | boolean | readonly (string | number | boolean)[];

export interface ApiRequestOptions {
  readonly params?: Readonly<Record<string, ApiQueryValue | null | undefined>>;
  readonly withCredentials?: boolean;
}

const schemaNamePattern = /(?:^|\/)tenant_[^/]+(?:\/|$)/i;
const blockedTenantQueryParameters = new Set(['empresaid', 'empresaslug', 'schemaname']);

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = normalizeBaseUrl(inject(API_BASE_URL));

  get<TResponse>(path: string, options: ApiRequestOptions = {}): Observable<TResponse> {
    return this.http.get<TResponse>(this.buildUrl(path), {
      params: this.buildParams(options.params),
      withCredentials: options.withCredentials,
    });
  }

  post<TResponse, TBody>(
    path: string,
    body: TBody,
    options: ApiRequestOptions = {},
  ): Observable<TResponse> {
    return this.http.post<TResponse>(this.buildUrl(path), body, {
      params: this.buildParams(options.params),
      withCredentials: options.withCredentials,
    });
  }

  patch<TResponse, TBody>(
    path: string,
    body: TBody,
    options: ApiRequestOptions = {},
  ): Observable<TResponse> {
    return this.http.patch<TResponse>(this.buildUrl(path), body, {
      params: this.buildParams(options.params),
      withCredentials: options.withCredentials,
    });
  }

  delete<TResponse>(path: string, options: ApiRequestOptions = {}): Observable<TResponse> {
    return this.http.delete<TResponse>(this.buildUrl(path), {
      params: this.buildParams(options.params),
      withCredentials: options.withCredentials,
    });
  }

  buildUrl(path: string): string {
    const normalizedPath = path.trim().replace(/^\/+|\/+$/g, '');

    if (
      normalizedPath.length === 0 ||
      path.includes('://') ||
      path.startsWith('//') ||
      path.includes('\\') ||
      normalizedPath.split('/').includes('..') ||
      schemaNamePattern.test(normalizedPath)
    ) {
      throw new Error('La ruta del API no es válida.');
    }

    return `${this.baseUrl}/${normalizedPath}`;
  }

  private buildParams(params: ApiRequestOptions['params']): HttpParams | undefined {
    if (!params) {
      return undefined;
    }

    let httpParams = new HttpParams();

    for (const [key, rawValue] of Object.entries(params)) {
      if (blockedTenantQueryParameters.has(key.toLowerCase())) {
        throw new Error(`${key} no es un parámetro permitido.`);
      }
      if (rawValue === null || rawValue === undefined) {
        continue;
      }

      const values = Array.isArray(rawValue) ? rawValue : [rawValue];
      for (const value of values) {
        httpParams = httpParams.append(key, String(value));
      }
    }

    return httpParams;
  }
}

function normalizeBaseUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/g, '');

  if (normalized.length === 0) {
    throw new Error('La URL base del API no está configurada.');
  }

  return normalized;
}
