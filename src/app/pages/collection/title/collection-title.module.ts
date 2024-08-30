import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

import { TextChangerComponent } from '@components/text-changer/text-changer.component';
import { TrustHtmlPipe } from '@pipes/trust-html.pipe';
import { CollectionTitlePage } from './collection-title.page';
import { CollectionTitlePageRoutingModule } from './collection-title-routing.module';


@NgModule({
  declarations: [
    CollectionTitlePage,
  ],
  imports: [
    CommonModule,
    IonicModule,
    TextChangerComponent,
    TrustHtmlPipe,
    CollectionTitlePageRoutingModule
  ],
})
export class CollectionTitlePageModule {}
