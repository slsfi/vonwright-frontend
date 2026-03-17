import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { CollectionSideMenuComponent } from '@components/menus/collection-side/collection-side-menu.component';
import { MainSideMenuComponent } from '@components/menus/main-side/main-side-menu.component';
import { StaticHtmlComponent } from '@components/static-html/static-html.component';
import { TopMenuComponent } from '@components/menus/top/top-menu.component';
import { config } from '@config';
import { authInterceptor } from '@interceptors/auth.interceptor';
import {
  BrowserRouteStateSourceService,
  RouteStateSourceService
} from '@services/route-state-source.service';
import {
  BrowserCollectionTextViewsQueryParamSyncService,
  CollectionTextViewsQueryParamSyncService
} from '@services/collection-text-views-query-param-sync.service';
import {
  AuthTokenStorageService,
  BrowserAuthTokenStorageService
} from '@services/auth-token-storage.service';
import {
  AuthRedirectStorageService,
  BrowserAuthRedirectStorageService
} from '@services/auth-redirect-storage.service';
import {
  BrowserRouterNavigationSourceService,
  RouterNavigationSourceService
} from '@services/router-navigation-source.service';
import {
  BrowserRouterPreloadingStrategyService,
  RouterPreloadingStrategyService
} from '@services/router-preloading-strategy.service';
import {
  BrowserFacsimileImageService,
  FacsimileImageService
} from '@services/facsimile-image.service';

const authEnabled = config?.app?.auth?.enabled === true;


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
    provideHttpClient(
      withFetch(),
      ...(authEnabled ? [withInterceptors([authInterceptor])] : [])
    ),
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    {
      provide: RouteStateSourceService,
      useClass: BrowserRouteStateSourceService
    },
    {
      provide: CollectionTextViewsQueryParamSyncService,
      useClass: BrowserCollectionTextViewsQueryParamSyncService
    },
    {
      provide: RouterNavigationSourceService,
      useClass: BrowserRouterNavigationSourceService
    },
    {
      provide: AuthTokenStorageService,
      useClass: BrowserAuthTokenStorageService
    },
    {
      provide: AuthRedirectStorageService,
      useClass: BrowserAuthRedirectStorageService
    },
    {
      provide: RouterPreloadingStrategyService,
      useClass: BrowserRouterPreloadingStrategyService
    },
    {
      provide: FacsimileImageService,
      useClass: BrowserFacsimileImageService
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
