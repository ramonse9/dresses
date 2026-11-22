import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { API_BASE_URL } from '../config/api-config';
import { AccessTokenStore } from './access-token.store';
import { AuthStore } from './auth.store';

const bearerExcludedPaths = [
  '/auth/login',
  '/auth/refresh',
  '/auth/invitaciones/verificar',
  '/auth/invitaciones/aceptar',
] as const;
const refreshExcludedPaths = [...bearerExcludedPaths, '/auth/me'] as const;

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const baseUrl = inject(API_BASE_URL).trim().replace(/\/+$/g, '');
  const accessTokens = inject(AccessTokenStore);
  const authStore = inject(AuthStore);

  if (!isApiRequest(request.url, baseUrl)) {
    return next(request);
  }

  const accessToken = accessTokens.token();
  const authenticatedRequest =
    accessToken && !matchesPath(request.url, baseUrl, bearerExcludedPaths)
      ? request.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } })
      : request;

  return next(authenticatedRequest).pipe(
    catchError((error: unknown) => {
      if (
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401 ||
        !accessToken ||
        matchesPath(request.url, baseUrl, refreshExcludedPaths)
      ) {
        return throwError(() => error);
      }

      return authStore.refreshAccessToken().pipe(
        switchMap((newAccessToken) =>
          next(
            request.clone({
              setHeaders: { Authorization: `Bearer ${newAccessToken}` },
            }),
          ),
        ),
      );
    }),
  );
};

function isApiRequest(url: string, baseUrl: string): boolean {
  return url === baseUrl || url.startsWith(`${baseUrl}/`);
}

function matchesPath(url: string, baseUrl: string, paths: readonly string[]): boolean {
  return paths.some((path) => url === `${baseUrl}${path}`);
}
