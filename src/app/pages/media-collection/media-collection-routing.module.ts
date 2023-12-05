import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { MediaCollectionPage } from './media-collection.page';


const routes: Routes = [
  {
    path: ':mediaCollectionID',
    component: MediaCollectionPage,
  },
  {
    path: '',
    component: MediaCollectionPage,
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class MediaCollectionPageRoutingModule {}
