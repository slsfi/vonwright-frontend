import { Routes } from '@angular/router';

export const collectionTextRoutes: Routes = [
  {
    path: ':publicationID',
    loadComponent: () => import('./collection-text.page').then(m => m.CollectionTextPage)
  },
  {
    path: ':publicationID/:chapterID',
    loadComponent: () => import('./collection-text.page').then(m => m.CollectionTextPage)
  }
];
