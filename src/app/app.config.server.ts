import {
  ApplicationConfig,
  importProvidersFrom,
  mergeApplicationConfig
} from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { IonicServerModule } from '@ionic/angular-server';

import {
  AuthRedirectStorageService,
  ServerAuthRedirectStorageService
} from '@services/auth-redirect-storage.service';
import {
  AuthTokenStorageService,
  ServerAuthTokenStorageService
} from '@services/auth-token-storage.service';
import {
  CollectionTextViewsQueryParamSyncService,
  ServerCollectionTextViewsQueryParamSyncService
} from '@services/collection-text-views-query-param-sync.service';
import {
  FacsimileImageService,
  ServerFacsimileImageService
} from '@services/facsimile-image.service';
import {
  RouteStateSourceService,
  ServerRouteStateSourceService
} from '@services/route-state-source.service';
import {
  RouterNavigationSourceService,
  ServerRouterNavigationSourceService
} from '@services/router-navigation-source.service';
import {
  RouterPreloadingStrategyService,
  ServerRouterPreloadingStrategyService
} from '@services/router-preloading-strategy.service';
import { appConfig } from './app.config';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(),
    // Ionic exposes its SSR providers only through this NgModule. This is the
    // sole intentional application-level compatibility bridge.
    importProvidersFrom(IonicServerModule),
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
  ]
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
