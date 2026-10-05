import { Routes } from '@angular/router';

export const aboutRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./about.page').then(m => m.AboutPage)
  },
  {
    path: ':id',
    loadComponent: () => import('./about.page').then(m => m.AboutPage)
  }
];
