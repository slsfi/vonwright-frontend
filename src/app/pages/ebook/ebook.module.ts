import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { EbookPageRoutingModule } from './ebook-routing.module';
import { EbookPage } from './ebook.page';
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
    PdfViewerComponent
  ]
})
export class EbookPageModule {}
