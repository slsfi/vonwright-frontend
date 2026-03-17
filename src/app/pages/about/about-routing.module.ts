import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AboutPage } from './about.page';

const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: AboutPage,
  },
  {
    path: ':id',
    component: AboutPage,
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AboutPageRoutingModule {}
