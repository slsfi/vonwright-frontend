import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

import { TrustHtmlPipe } from '@pipes/trust-html.pipe';
import { PageNotFoundPageRoutingModule } from './page-not-found-routing.module';
import { PageNotFoundPage } from './page-not-found.page';


@NgModule({
  declarations: [
    PageNotFoundPage,
  ],
  imports: [
    CommonModule,
    IonicModule,
    TrustHtmlPipe,
    PageNotFoundPageRoutingModule
  ]
})
export class PageNotFoundPageModule {}
