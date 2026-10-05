import { Routes } from '@angular/router';

export const ebookRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./ebook.page').then(m => m.EbookPage)
  },
  {
    path: ':filename',
    loadComponent: () => import('./ebook.page').then(m => m.EbookPage)
  },
  {
    path: ':type/:name',
    loadComponent: () => import('./ebook.page').then(m => m.EbookPage)
  }
];
