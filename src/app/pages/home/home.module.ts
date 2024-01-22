import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { ContentGridComponent } from '@components/content-grid/content-grid.component';
import { TrustHtmlPipe } from '@pipes/trust-html-pipe';
import { HomePageRoutingModule } from './home-routing.module';
import { HomePage } from './home.page';


@NgModule({
  declarations: [
    HomePage
  ],
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ContentGridComponent,
    TrustHtmlPipe,
    HomePageRoutingModule
  ],
})
export class HomePageModule {}
