import type { Routes } from '@angular/router';

export const AUDIT_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./audit-list-page.component').then(
        ({ AuditListPageComponent }) => AuditListPageComponent,
      ),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./audit-detail-page.component').then(
        ({ AuditDetailPageComponent }) => AuditDetailPageComponent,
      ),
  },
];
