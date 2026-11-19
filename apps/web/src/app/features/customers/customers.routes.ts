import type { Routes } from '@angular/router';

export const CUSTOMERS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./customers-list-page.component').then(
        ({ CustomersListPageComponent }) => CustomersListPageComponent,
      ),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./customer-detail-page.component').then(
        ({ CustomerDetailPageComponent }) => CustomerDetailPageComponent,
      ),
  },
];
