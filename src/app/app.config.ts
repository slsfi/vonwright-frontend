import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  Type,
  provideBrowserGlobalErrorListeners
} from '@angular/core';
import {
  RouteReuseStrategy,
  PreloadingStrategy,
  provideRouter,
  withEnabledBlockingInitialNavigation,
  withPreloading,
  withRouterConfig
} from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';

import { config } from '@config';
import { authInterceptor } from '@interceptors/auth.interceptor';
import {
  AuthRedirectStorageService,
  BrowserAuthRedirectStorageService
} from '@services/auth-redirect-storage.service';
import {
  AuthTokenStorageService,
  BrowserAuthTokenStorageService
} from '@services/auth-token-storage.service';
import {
  BrowserCollectionTextViewsQueryParamSyncService,
  CollectionTextViewsQueryParamSyncService
} from '@services/collection-text-views-query-param-sync.service';
import {
  BrowserFacsimileImageService,
  FacsimileImageService
} from '@services/facsimile-image.service';
import {
  BrowserRouteStateSourceService,
  RouteStateSourceService
} from '@services/route-state-source.service';
import {
  BrowserRouterNavigationSourceService,
  RouterNavigationSourceService
} from '@services/router-navigation-source.service';
import {
  BrowserRouterPreloadingStrategyService,
  RouterPreloadingStrategyService
} from '@services/router-preloading-strategy.service';
import { routes } from './app.routes';

const authEnabled = config?.app?.auth?.enabled === true;
// Angular types `withPreloading` for concrete classes only, but `useExisting`
// also supports this abstract class as the browser/server-switchable DI token.
const routerPreloadingStrategyToken =
  RouterPreloadingStrategyService as unknown as Type<PreloadingStrategy>;

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideIonicAngular({ mode: 'md' }),
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideRouter(
      routes,
      withPreloading(routerPreloadingStrategyToken),
      withEnabledBlockingInitialNavigation(),
      withRouterConfig({ paramsInheritanceStrategy: 'emptyOnly' })
    ),
    provideHttpClient(
      ...(authEnabled ? [withInterceptors([authInterceptor])] : [])
    ),
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
  ]
};
