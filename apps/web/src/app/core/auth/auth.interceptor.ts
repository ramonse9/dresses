import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { API_BASE_URL } from '../config/api-config';
import { AccessTokenStore } from './access-token.store';
import { AuthStore } from './auth.store';

const nonRefreshablePaths = ['/auth/login', '/auth/refresh', '/auth/me'] as const;

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const baseUrl = inject(API_BASE_URL).trim().replace(/\/+$/g, '');
  const accessTokens = inject(AccessTokenStore);
  const authStore = inject(AuthStore);

  if (!isApiRequest(request.url, baseUrl)) {
    return next(request);
  }

  const accessToken = accessTokens.token();
  const authenticatedRequest = accessToken
    ? request.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } })
    : request;

  return next(authenticatedRequest).pipe(
    catchError((error: unknown) => {
      if (
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401 ||
        !accessToken ||
        isNonRefreshableRequest(request.url, baseUrl)
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

function isNonRefreshableRequest(url: string, baseUrl: string): boolean {
  return nonRefreshablePaths.some((path) => url === `${baseUrl}${path}`);
}
