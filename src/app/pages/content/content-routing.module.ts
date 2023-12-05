import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ContentPage } from './content.page';

const routes: Routes = [
  {
    path: '',
    component: ContentPage,
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ContentPageRoutingModule {}
