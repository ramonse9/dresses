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
    path: 'nuevo',
    loadComponent: () =>
      import('./customer-create-page.component').then(
        ({ CustomerCreatePageComponent }) => CustomerCreatePageComponent,
      ),
  },
  {
    path: ':id/editar',
    loadComponent: () =>
      import('./customer-edit-page.component').then(
        ({ CustomerEditPageComponent }) => CustomerEditPageComponent,
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
