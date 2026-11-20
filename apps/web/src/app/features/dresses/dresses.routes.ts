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
    path: 'nuevo',
    loadComponent: () =>
      import('./dress-create-page.component').then(
        ({ DressCreatePageComponent }) => DressCreatePageComponent,
      ),
  },
  {
    path: ':id/editar',
    loadComponent: () =>
      import('./dress-edit-page.component').then(
        ({ DressEditPageComponent }) => DressEditPageComponent,
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
