import type { Routes } from '@angular/router';

export const DRESSES_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./dresses-list-page.component').then(
        ({ DressesListPageComponent }) => DressesListPageComponent,
      ),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./dress-detail-page.component').then(
        ({ DressDetailPageComponent }) => DressDetailPageComponent,
      ),
  },
];
