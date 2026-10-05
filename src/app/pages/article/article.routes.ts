import { Routes } from '@angular/router';

export const articleRoutes: Routes = [
  {
    path: ':name',
    loadComponent: () => import('./article.page').then(m => m.ArticlePage)
  }
];
