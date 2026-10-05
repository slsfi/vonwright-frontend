import { HttpClient } from '@angular/common/http';
import {
  ProviderToken,
  Type,
  ɵIS_ENABLED_BLOCKING_INITIAL_NAVIGATION,
  ɵPROVIDED_NG_ZONE
} from '@angular/core';
import {
  ExtraOptions,
  PreloadingStrategy,
  ROUTER_CONFIGURATION,
  ROUTES,
  RouteReuseStrategy
} from '@angular/router';
import { IonicRouteStrategy } from '@ionic/angular';

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
import { appConfig } from './app.config';
import { AppComponent } from './app.component';
import { routes } from './app.routes';

type PlatformProviderExpectation = {
  token: ProviderToken<unknown>;
  browser: Type<unknown>;
};

type ProviderRecord = {
  provide?: unknown;
  useClass?: Type<unknown>;
  useExisting?: unknown;
  useValue?: unknown;
};

const platformProviderExpectations: PlatformProviderExpectation[] = [
  {
    token: RouteStateSourceService,
    browser: BrowserRouteStateSourceService
  },
  {
    token: CollectionTextViewsQueryParamSyncService,
    browser: BrowserCollectionTextViewsQueryParamSyncService
  },
  {
    token: RouterNavigationSourceService,
    browser: BrowserRouterNavigationSourceService
  },
  {
    token: AuthTokenStorageService,
    browser: BrowserAuthTokenStorageService
  },
  {
    token: AuthRedirectStorageService,
    browser: BrowserAuthRedirectStorageService
  },
  {
    token: RouterPreloadingStrategyService,
    browser: BrowserRouterPreloadingStrategyService
  },
  {
    token: FacsimileImageService,
    browser: BrowserFacsimileImageService
  }
];

describe('appConfig', () => {
  const providers = flattenProviders(appConfig.providers);

  it('preserves canonical routes and router behavior', () => {
    const options = findProvider(ROUTER_CONFIGURATION).useValue as ExtraOptions;

    expect(findProvider(ROUTES).useValue).toBe(routes);
    expect(options.paramsInheritanceStrategy).toBe('emptyOnly');
    expect(findProvider(PreloadingStrategy).useExisting)
      .toBe(RouterPreloadingStrategyService);
    expect(findProvider(ɵIS_ENABLED_BLOCKING_INITIAL_NAVIGATION).useValue)
      .toBeTrue();
  });

  it('uses Ionic route reuse', () => {
    expect(findProvider(RouteReuseStrategy).useClass).toBe(IonicRouteStrategy);
  });

  it('selects browser implementations for platform-specific services', () => {
    for (const expectation of platformProviderExpectations) {
      expect(findProvider(expectation.token).useClass)
        .withContext(expectation.browser.name)
        .toBe(expectation.browser);
    }
  });

  it('provides HttpClient once and conditionally registers the auth interceptor', () => {
    const httpClientProviderCount = providers.filter(provider => provider === HttpClient).length;
    const authInterceptorRegistered = providers.some(provider =>
      isProviderRecord(provider) && provider.useValue === authInterceptor
    );

    expect(httpClientProviderCount).toBe(1);
    expect(authInterceptorRegistered).toBe(config.app.auth?.enabled === true);
  });

  it('uses Angular default zoneless change detection', () => {
    const optsIntoNgZoneChangeDetection = providers.some(provider =>
      isProviderRecord(provider) && provider.provide === ɵPROVIDED_NG_ZONE
    );

    expect(optsIntoNgZoneChangeDetection).toBeFalse();
  });

  it('uses a standalone OnPush root component', () => {
    const componentDefinition = (
      AppComponent as typeof AppComponent & {
        ɵcmp?: { onPush?: boolean; standalone?: boolean };
      }
    ).ɵcmp;

    expect(componentDefinition?.standalone).toBeTrue();
    expect(componentDefinition?.onPush).toBeTrue();
  });

  function findProvider(token: unknown): ProviderRecord {
    const provider = providers.find((candidate): candidate is ProviderRecord =>
      isProviderRecord(candidate) && candidate.provide === token
    );
    expect(provider).withContext(String(token)).toBeDefined();
    return provider as ProviderRecord;
  }
});

function flattenProviders(providers: readonly unknown[]): unknown[] {
  return providers.flatMap(provider => {
    if (Array.isArray(provider)) {
      return flattenProviders(provider);
    }

    if (provider && typeof provider === 'object' && 'ɵproviders' in provider) {
      const nestedProviders = (provider as { ɵproviders: readonly unknown[] }).ɵproviders;
      return [provider, ...flattenProviders(nestedProviders)];
    }

    return [provider];
  });
}

function isProviderRecord(provider: unknown): provider is ProviderRecord {
  return !!provider && typeof provider === 'object' && 'provide' in provider;
}
