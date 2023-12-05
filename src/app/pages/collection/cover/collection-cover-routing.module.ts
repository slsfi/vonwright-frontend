import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { CollectionCoverPage } from './collection-cover.page';


const routes: Routes = [
  {
    path: '',
    component: CollectionCoverPage,
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CollectionCoverPageRoutingModule {}
