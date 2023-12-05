import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { EbookPageRoutingModule } from './ebook-routing.module';
import { EbookPage } from './ebook.page';
import { EpubViewerComponent } from '@components/epub-viewer/epub-viewer.component';
import { PdfViewerComponent } from '@components/pdf-viewer/pdf-viewer.component';


@NgModule({
  declarations: [
    EbookPage
  ],
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    EbookPageRoutingModule,
    EpubViewerComponent,
    PdfViewerComponent
  ]
})
export class EbookPageModule {}
