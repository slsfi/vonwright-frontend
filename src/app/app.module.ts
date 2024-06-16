import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { CollectionSideMenuComponent } from '@components/menus/collection-side/collection-side-menu.component';
import { MainSideMenuComponent } from '@components/menus/main-side/main-side-menu.component';
import { StaticHtmlComponent } from '@components/static-html/static-html.component';
import { TopMenuComponent } from '@components/menus/top/top-menu.component';


@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    IonicModule.forRoot({
      mode: 'md'
    }),
    AppRoutingModule,
    CommonModule,
    CollectionSideMenuComponent,
    MainSideMenuComponent,
    StaticHtmlComponent,
    TopMenuComponent
  ],
  providers: [
    provideHttpClient(withFetch()),
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy }
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
