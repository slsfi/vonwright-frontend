import { Routes } from '@angular/router';

export const mediaCollectionRoutes: Routes = [
  {
    path: ':mediaCollectionID',
    loadComponent: () => import('./media-collection.page').then(m => m.MediaCollectionPage)
  },
  {
    path: '',
    loadComponent: () => import('./media-collection.page').then(m => m.MediaCollectionPage)
  }
];
