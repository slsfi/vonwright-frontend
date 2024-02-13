import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { BrowserModule, Title } from '@angular/platform-browser';
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
      backButtonText: '',
      mode: 'md',
      platform: {
        /**
         * The default `desktop` function returns false for devices with a touchscreen.
         * This is not wanted, so test the user agent for 'Mobi' instead, see
         * - https://developer.mozilla.org/en-US/docs/Web/HTTP/Browser_detection_using_the_user_agent#mobile_tablet_or_desktop
         * - https://ionicframework.com/docs/angular/platform#customizing-platform-detection-functions
         */
        'desktop': (win) => {
          const isMobile = /Mobi/i.test(win.navigator.userAgent);
          return !isMobile;
        }
      }
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
    Title,
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy }
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
