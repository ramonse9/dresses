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
    path: ':id',
    loadComponent: () =>
      import('./reservation-detail-page.component').then(
        ({ ReservationDetailPageComponent }) => ReservationDetailPageComponent,
      ),
  },
];
