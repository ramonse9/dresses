import type { Routes } from '@angular/router';

export const TEAM_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./team-list-page.component').then(
        ({ TeamListPageComponent }) => TeamListPageComponent,
      ),
  },
  {
    path: 'invitaciones',
    loadComponent: () =>
      import('./team-invitations-page.component').then(
        ({ TeamInvitationsPageComponent }) => TeamInvitationsPageComponent,
      ),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./team-detail-page.component').then(
        ({ TeamDetailPageComponent }) => TeamDetailPageComponent,
      ),
  },
];
