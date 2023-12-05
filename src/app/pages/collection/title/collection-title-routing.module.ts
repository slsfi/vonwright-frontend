import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { CollectionTitlePage } from './collection-title.page';


const routes: Routes = [
  {
    path: '',
    component: CollectionTitlePage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CollectionTitlePageRoutingModule {}
