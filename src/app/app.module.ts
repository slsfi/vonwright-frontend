import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { BrowserModule, Title } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';

import { AppRoutingModule } from './app-routing.module';
import { DigitalEditionApp } from './app.component';
import { CollectionSideMenuComponent } from '@components/menus/collection-side/collection-side-menu.component';
import { MainSideMenuComponent } from '@components/menus/main-side/main-side-menu.component';
import { TopMenuComponent } from '@components/menus/top/top-menu.component';


@NgModule({
  declarations: [
    DigitalEditionApp
  ],
  imports: [
    BrowserModule,
    IonicModule.forRoot(
      {
        mode: 'md',
        backButtonText: '',
      }
    ),
    AppRoutingModule,
    HttpClientModule,
    CommonModule,
    CollectionSideMenuComponent,
    MainSideMenuComponent,
    TopMenuComponent
  ],
  providers: [
    Title,
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy }
  ],
  bootstrap: [DigitalEditionApp]
})
export class AppModule {}
