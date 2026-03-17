import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Observable, filter, map, of } from 'rxjs';
import { Request } from 'express';

import { REQUEST } from 'src/express.tokens';


/**
 * Provides route navigation URLs in a platform-specific way.
 *
 * Why this abstraction exists:
 * - Browser: react to every NavigationEnd event.
 * - Server (SSR): emit only one URL snapshot for the current request.
 */
export abstract class RouterNavigationSourceService {
  /**
   * Returns an observable of router URLs.
   * @param router Router instance to read navigation state from.
   */
  abstract get(router: Router): Observable<string>;
}

/**
 * Browser implementation:
 * emits on each NavigationEnd.
 */
@Injectable()
export class BrowserRouterNavigationSourceService
  extends RouterNavigationSourceService {
  get(router: Router): Observable<string> {
    return router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event: NavigationEnd) => event.url)
    );
  }
}

/**
 * Server implementation:
 * emits one URL snapshot and completes.
 */
@Injectable()
export class ServerRouterNavigationSourceService
  extends RouterNavigationSourceService {
  private request = inject<Request>(REQUEST, { optional: true });

  get(router: Router): Observable<string> {
    return of(this.request?.url || this.request?.originalUrl || router.url);
  }
}
