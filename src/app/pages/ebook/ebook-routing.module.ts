import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { EbookPage } from './ebook.page';

const routes: Routes = [
  {
    path: '',
    component: EbookPage,
  },
  {
    path: ':filename',
    component: EbookPage,
  },
  {
    path: ':type/:name',
    component: EbookPage,
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class EbookPageRoutingModule {}
