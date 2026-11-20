import type { Routes } from '@angular/router';

export const RESERVATIONS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./reservations-list-page.component').then(
        ({ ReservationsListPageComponent }) => ReservationsListPageComponent,
      ),
  },
  {
    path: 'nueva',
    loadComponent: () =>
      import('./reservation-create-page.component').then(
        ({ ReservationCreatePageComponent }) => ReservationCreatePageComponent,
      ),
  },
  {
    path: ':id/editar',
    loadComponent: () =>
      import('./reservation-edit-page.component').then(
        ({ ReservationEditPageComponent }) => ReservationEditPageComponent,
      ),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./reservation-detail-page.component').then(
        ({ ReservationDetailPageComponent }) => ReservationDetailPageComponent,
      ),
  },
];
