import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guards';
import { tenantGuard } from './core/tenant/tenant.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./layouts/public-layout/public-layout.component').then(
        ({ PublicLayoutComponent }) => PublicLayoutComponent,
      ),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./features/public/home/home-page.component').then(
            ({ HomePageComponent }) => HomePageComponent,
          ),
      },
      {
        path: 'login',
        canActivate: [guestGuard],
        loadComponent: () =>
          import('./features/auth/login/login-page.component').then(
            ({ LoginPageComponent }) => LoginPageComponent,
          ),
      },
      {
        path: 'seleccionar-empresa',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/tenancy/select-company/select-company-page.component').then(
            ({ SelectCompanyPageComponent }) => SelectCompanyPageComponent,
          ),
      },
    ],
  },
  {
    path: 'app',
    canActivate: [authGuard, tenantGuard],
    loadComponent: () =>
      import('./layouts/app-layout/app-layout.component').then(
        ({ AppLayoutComponent }) => AppLayoutComponent,
      ),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./features/dashboard/dashboard-placeholder.component').then(
            ({ DashboardPlaceholderComponent }) => DashboardPlaceholderComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
