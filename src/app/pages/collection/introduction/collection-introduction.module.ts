import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

import { TextChangerComponent } from '@components/text-changer/text-changer.component';
import { TrustHtmlPipe } from '@pipes/trust-html-pipe';
import { CollectionIntroductionPage } from './collection-introduction.page';
import { CollectionIntroductionPageRoutingModule } from './collection-introduction-routing.module';


@NgModule({
  declarations: [
    CollectionIntroductionPage,
  ],
  imports: [
    CommonModule,
    IonicModule,
    TextChangerComponent,
    TrustHtmlPipe,
    CollectionIntroductionPageRoutingModule
  ],
})
export class CollectionIntroductionPageModule {}
