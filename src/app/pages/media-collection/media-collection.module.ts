import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { MediaCollectionPageRoutingModule } from './media-collection-routing.module';
import { MediaCollectionPage } from './media-collection.page';


@NgModule({
  declarations: [
    MediaCollectionPage,
  ],
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    MediaCollectionPageRoutingModule
  ],
})
export class MediaCollectionPageModule {}
