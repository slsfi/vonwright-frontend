import { Injectable } from '@angular/core';
import { NoPreloading, PreloadingStrategy, Route } from '@angular/router';
import { EMPTY, Observable, Subscription } from 'rxjs';


export type RoutePreloadMode = 'eager' | 'idle' | 'idle-if-fast' | 'off';

type NavigatorWithConnection = Navigator & {
  connection?: {
    effectiveType?: string;
    saveData?: boolean;
  };
};

type IdleDeadlineLike = {
  didTimeout: boolean;
  timeRemaining: () => number;
};

type IdleOptionsLike = {
  timeout?: number;
};

type WindowWithIdleCallback = Window & {
  requestIdleCallback?: (
    callback: (deadline: IdleDeadlineLike) => void,
    options?: IdleOptionsLike
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};


/**
 * Provides router preloading behavior in a platform-specific way.
 *
 * Why this abstraction exists:
 * - Browser: preload lazy routes after navigation.
 * - Server (SSR): skip preloading to avoid extra render-time work.
 */
export abstract class RouterPreloadingStrategyService implements PreloadingStrategy {
  abstract preload(route: Route, load: () => Observable<any>): Observable<any>;
}

/**
 * Browser implementation:
 * uses route data and preloads only selected lazy routes.
 *
 * Route data API:
 * - `data: { preload: 'eager' }` -> preload immediately.
 * - `data: { preload: 'idle' }` -> preload when browser is idle.
 * - `data: { preload: 'idle-if-fast' }` -> preload when idle on good networks.
 * - missing -> defaults to `idle-if-fast`.
 * - `data: { preload: 'off' }` -> no preloading.
 *
 * Network-quality fallback:
 * if browser network information is unavailable, the network is treated as
 * good and idle preloading is allowed.
 */
@Injectable()
export class BrowserRouterPreloadingStrategyService
  extends RouterPreloadingStrategyService {
  preload(route: Route, load: () => Observable<any>): Observable<any> {
    const mode = this.getMode(route);

    if (mode === 'eager') {
      return load();
    }

    if (mode === 'idle') {
      return this.preloadWhenIdle(load);
    }

    if (mode === 'idle-if-fast') {
      return this.hasGoodNetworkConditions()
        ? this.preloadWhenIdle(load)
        : EMPTY;
    }

    return EMPTY;
  }

  private getMode(route: Route): RoutePreloadMode {
    const mode = route.data?.['preload'] as RoutePreloadMode | undefined;

    if (mode === 'eager' || mode === 'idle' || mode === 'idle-if-fast') {
      return mode;
    }

    if (mode === 'off') {
      return 'off';
    }

    return 'idle-if-fast';
  }

  private preloadWhenIdle(load: () => Observable<any>): Observable<any> {
    return new Observable<any>(subscriber => {
      if (typeof window === 'undefined') {
        const innerSub = load().subscribe(subscriber);
        return () => innerSub.unsubscribe();
      }

      const win = window as WindowWithIdleCallback;
      let idleHandle: number | undefined = undefined;
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined = undefined;
      let innerSub: Subscription | undefined = undefined;
      let started = false;

      const startPreload = () => {
        if (started) {
          return;
        }
        started = true;
        innerSub = load().subscribe(subscriber);
      };

      if (typeof win.requestIdleCallback === 'function') {
        idleHandle = win.requestIdleCallback(
          () => startPreload(),
          { timeout: 2000 }
        );

        return () => {
          if (
            idleHandle !== undefined &&
            typeof win.cancelIdleCallback === 'function'
          ) {
            win.cancelIdleCallback(idleHandle);
          }
          innerSub?.unsubscribe();
        };
      }

      timeoutHandle = setTimeout(() => startPreload(), 300);
      return () => {
        if (timeoutHandle !== undefined) {
          clearTimeout(timeoutHandle);
        }
        innerSub?.unsubscribe();
      };
    });
  }

  private hasGoodNetworkConditions(): boolean {
    if (typeof navigator === 'undefined') {
      // Browser/network info unavailable: treat as good and allow idle preload.
      return true;
    }

    const nav = navigator as NavigatorWithConnection;
    const connection = nav.connection;

    if (!connection) {
      // Browser does not expose effective network quality: allow idle preload.
      return true;
    }

    if (connection.saveData) {
      return false;
    }

    const effectiveType = connection.effectiveType ?? '';
    return !['slow-2g', '2g', '3g'].includes(effectiveType);
  }
}

/**
 * Server implementation:
 * uses Angular's NoPreloading strategy.
 */
@Injectable()
export class ServerRouterPreloadingStrategyService
  extends RouterPreloadingStrategyService {
  private readonly strategy = new NoPreloading();

  preload(route: Route, load: () => Observable<any>): Observable<any> {
    return this.strategy.preload(route, load);
  }
}
