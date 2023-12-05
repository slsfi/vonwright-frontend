import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { CollectionTextPage } from './collection-text.page';


const routes: Routes = [
  {
    path: ':publicationID',
    component: CollectionTextPage,
  },
  {
    path: ':publicationID/:chapterID',
    component: CollectionTextPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CollectionTextPageRoutingModule {}
