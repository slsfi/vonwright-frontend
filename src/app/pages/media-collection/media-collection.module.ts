import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { GalleryThumbImageComponent } from '@components/gallery-thumb-image/gallery-thumb-image.component';
import { TrustHtmlPipe } from '@pipes/trust-html.pipe';
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
    GalleryThumbImageComponent,
    TrustHtmlPipe,
    MediaCollectionPageRoutingModule
  ],
})
export class MediaCollectionPageModule {}
