import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

import { TextChangerComponent } from '@components/text-changer/text-changer.component';
import { CollectionForewordPage } from './collection-foreword.page';
import { CollectionForewordPageRoutingModule } from './collection-foreword-routing.module';


@NgModule({
  declarations: [
    CollectionForewordPage,
  ],
  imports: [
    CommonModule,
    IonicModule,
    TextChangerComponent,
    CollectionForewordPageRoutingModule
  ],
})
export class CollectionForewordPageModule {}
