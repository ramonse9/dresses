import { type Routes } from '@angular/router';
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
        path: 'aceptar-invitacion',
        loadComponent: () =>
          import('./features/auth/invitation-acceptance/invitation-acceptance-page.component').then(
            ({ InvitationAcceptancePageComponent }) => InvitationAcceptancePageComponent,
          ),
      },
      {
        path: 'olvide-password',
        loadComponent: () =>
          import('./features/auth/password-recovery/request-password-page.component').then(
            ({ RequestPasswordPageComponent }) => RequestPasswordPageComponent,
          ),
      },
      {
        path: 'restablecer-password',
        loadComponent: () =>
          import('./features/auth/password-recovery/reset-password-page.component').then(
            ({ ResetPasswordPageComponent }) => ResetPasswordPageComponent,
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
    path: 'cuenta',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layouts/account-layout/account-layout.component').then(
        ({ AccountLayoutComponent }) => AccountLayoutComponent,
      ),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'sesiones' },
      {
        path: 'sesiones',
        loadComponent: () =>
          import('./features/account/sessions/account-sessions-page.component').then(
            ({ AccountSessionsPageComponent }) => AccountSessionsPageComponent,
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
        redirectTo: 'dashboard',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard-placeholder.component').then(
            ({ DashboardPlaceholderComponent }) => DashboardPlaceholderComponent,
          ),
      },
      {
        path: 'sucursales',
        loadChildren: () =>
          import('./features/branches/branches.routes').then(
            ({ BRANCHES_ROUTES }) => BRANCHES_ROUTES,
          ),
      },
      {
        path: 'clientes',
        loadChildren: () =>
          import('./features/customers/customers.routes').then(
            ({ CUSTOMERS_ROUTES }) => CUSTOMERS_ROUTES,
          ),
      },
      {
        path: 'vestidos',
        loadChildren: () =>
          import('./features/dresses/dresses.routes').then(({ DRESSES_ROUTES }) => DRESSES_ROUTES),
      },
      {
        path: 'disponibilidad',
        loadComponent: () =>
          import('./features/availability/availability-page.component').then(
            ({ AvailabilityPageComponent }) => AvailabilityPageComponent,
          ),
      },
      {
        path: 'reservaciones',
        loadChildren: () =>
          import('./features/reservations/reservations.routes').then(
            ({ RESERVATIONS_ROUTES }) => RESERVATIONS_ROUTES,
          ),
      },
      {
        path: 'equipo',
        loadChildren: () =>
          import('./features/team/team.routes').then(({ TEAM_ROUTES }) => TEAM_ROUTES),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
