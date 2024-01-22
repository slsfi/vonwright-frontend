import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { TrustHtmlPipe } from '@pipes/trust-html-pipe';
import { IndexPageRoutingModule } from './index-routing.module';
import { IndexPage } from './index.page';


@NgModule({
  declarations: [
    IndexPage,
  ],
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TrustHtmlPipe,
    IndexPageRoutingModule
  ]
})
export class IndexPageModule {}
