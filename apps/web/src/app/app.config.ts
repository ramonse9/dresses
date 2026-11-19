import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { firstValueFrom, of, switchMap } from 'rxjs';
import { environment } from '../environments/environment';
import { AuthStore } from './core/auth/auth.store';
import { authInterceptor } from './core/auth/auth.interceptor';
import { API_BASE_URL } from './core/config/api-config';
import { TenantStore } from './core/tenant/tenant.store';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(routes),
    { provide: API_BASE_URL, useValue: environment.apiBaseUrl },
    provideAppInitializer(() => {
      const authStore = inject(AuthStore);
      const tenantStore = inject(TenantStore);

      return firstValueFrom(
        authStore
          .initialize()
          .pipe(
            switchMap(() =>
              authStore.isAuthenticated() ? tenantStore.initialize() : of(undefined),
            ),
          ),
      );
    }),
  ],
};
