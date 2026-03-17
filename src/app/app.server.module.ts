import { NgModule } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ServerModule } from '@angular/platform-server';
import { IonicServerModule } from '@ionic/angular-server';

import { AppModule } from './app.module';
import { AppComponent } from './app.component';
import { config } from '@config';
import { authInterceptor } from '@interceptors/auth.interceptor';
import {
  RouteStateSourceService,
  ServerRouteStateSourceService
} from '@services/route-state-source.service';
import {
  CollectionTextViewsQueryParamSyncService,
  ServerCollectionTextViewsQueryParamSyncService
} from '@services/collection-text-views-query-param-sync.service';
import {
  AuthTokenStorageService,
  ServerAuthTokenStorageService
} from '@services/auth-token-storage.service';
import {
  AuthRedirectStorageService,
  ServerAuthRedirectStorageService
} from '@services/auth-redirect-storage.service';
import {
  RouterNavigationSourceService,
  ServerRouterNavigationSourceService
} from '@services/router-navigation-source.service';
import {
  RouterPreloadingStrategyService,
  ServerRouterPreloadingStrategyService
} from '@services/router-preloading-strategy.service';
import {
  FacsimileImageService,
  ServerFacsimileImageService
} from '@services/facsimile-image.service';

const authEnabled = config?.app?.auth?.enabled === true;


@NgModule({
  imports: [
    AppModule,
    ServerModule,
    IonicServerModule,
  ],
  providers: [
    provideHttpClient(
      withFetch(),
      ...(authEnabled ? [withInterceptors([authInterceptor])] : [])
    ),
    {
      provide: RouteStateSourceService,
      useClass: ServerRouteStateSourceService
    },
    {
      provide: CollectionTextViewsQueryParamSyncService,
      useClass: ServerCollectionTextViewsQueryParamSyncService
    },
    {
      provide: RouterNavigationSourceService,
      useClass: ServerRouterNavigationSourceService
    },
    {
      provide: AuthTokenStorageService,
      useClass: ServerAuthTokenStorageService
    },
    {
      provide: AuthRedirectStorageService,
      useClass: ServerAuthRedirectStorageService
    },
    {
      provide: RouterPreloadingStrategyService,
      useClass: ServerRouterPreloadingStrategyService
    },
    {
      provide: FacsimileImageService,
      useClass: ServerFacsimileImageService
    }
  ],
  bootstrap: [AppComponent],
})
export class AppServerModule {}
