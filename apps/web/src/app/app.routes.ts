import { Routes } from '@angular/router';

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
        loadComponent: () =>
          import('./features/auth/login/login-placeholder.component').then(
            ({ LoginPlaceholderComponent }) => LoginPlaceholderComponent,
          ),
      },
      {
        path: 'seleccionar-empresa',
        loadComponent: () =>
          import('./features/tenancy/select-company/select-company-placeholder.component').then(
            ({ SelectCompanyPlaceholderComponent }) => SelectCompanyPlaceholderComponent,
          ),
      },
    ],
  },
  {
    path: 'app',
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
