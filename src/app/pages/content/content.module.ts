import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { ContentGridComponent } from '@components/content-grid/content-grid.component';
import { ContentPage } from './content.page';
import { ContentPageRoutingModule } from './content-routing.module';


@NgModule({
  declarations: [
    ContentPage
  ],
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ContentGridComponent,
    ContentPageRoutingModule
  ]
})
export class ContentPageModule { }
