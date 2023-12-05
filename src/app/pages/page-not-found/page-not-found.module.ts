import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

import { PageNotFoundPageRoutingModule } from './page-not-found-routing.module';
import { PageNotFoundPage } from './page-not-found.page';


@NgModule({
  declarations: [
    PageNotFoundPage,
  ],
  imports: [
    CommonModule,
    IonicModule,
    PageNotFoundPageRoutingModule
  ]
})
export class PageNotFoundPageModule {}
