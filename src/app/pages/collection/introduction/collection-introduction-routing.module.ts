import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { CollectionIntroductionPage } from './collection-introduction.page';


const routes: Routes = [
  {
    path: '',
    component: CollectionIntroductionPage,
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CollectionIntroductionPageRoutingModule {}
