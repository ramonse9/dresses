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
    path: 'nueva',
    loadComponent: () =>
      import('./branch-create-page.component').then(
        ({ BranchCreatePageComponent }) => BranchCreatePageComponent,
      ),
  },
  {
    path: ':id/editar',
    loadComponent: () =>
      import('./branch-edit-page.component').then(
        ({ BranchEditPageComponent }) => BranchEditPageComponent,
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
