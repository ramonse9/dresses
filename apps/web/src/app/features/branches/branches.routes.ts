import type { Routes } from '@angular/router';

export const BRANCHES_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./branches-list-page.component').then(
        ({ BranchesListPageComponent }) => BranchesListPageComponent,
      ),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./branch-detail-page.component').then(
        ({ BranchDetailPageComponent }) => BranchDetailPageComponent,
      ),
  },
];
