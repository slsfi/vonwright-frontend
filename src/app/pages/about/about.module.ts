import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

import { TrustHtmlPipe } from '@pipes/trust-html.pipe';
import { AboutPage } from './about.page';
import { AboutPageRoutingModule } from './about-routing.module';

@NgModule({
  declarations: [
    AboutPage
  ],
  imports: [
    CommonModule,
    IonicModule,
    TrustHtmlPipe,
    AboutPageRoutingModule,
  ]
})
export class AboutPageModule {}
