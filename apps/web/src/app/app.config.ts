import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';
import { AuthStore } from './core/auth/auth.store';
import { authInterceptor } from './core/auth/auth.interceptor';
import { API_BASE_URL } from './core/config/api-config';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(routes),
    { provide: API_BASE_URL, useValue: environment.apiBaseUrl },
    provideAppInitializer(() => firstValueFrom(inject(AuthStore).initialize())),
  ],
};
