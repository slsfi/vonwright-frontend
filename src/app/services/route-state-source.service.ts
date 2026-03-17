import { Injectable } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import { Observable, combineLatest, filter, map, of } from 'rxjs';


export type RouteState = {
  params: Params;
  queryParams: Params;
};

/**
 * Provides route + query-param state in a platform-specific way.
 *
 * Why this abstraction exists:
 * - Browser: subscribe reactively to route/query changes.
 * - Server (SSR): emit one snapshot state only for the current request.
 */
export abstract class RouteStateSourceService {
  /**
   * Gets route state as an Observable.
   * @param route Route instance to read from.
   * @param active$ Optional active-state stream. If provided in browser mode,
   * emissions are gated to `active === true`.
   */
  abstract get(
    route: ActivatedRoute,
    active$?: Observable<boolean>
  ): Observable<RouteState>;
}

/**
 * Browser implementation:
 * - without `active$`: emits on every route/query change.
 * - with `active$`: emits only while `active$` is true.
 */
@Injectable()
export class BrowserRouteStateSourceService extends RouteStateSourceService {
  get(
    route: ActivatedRoute,
    active$?: Observable<boolean>
  ): Observable<RouteState> {
    if (active$) {
      return combineLatest([route.params, route.queryParams, active$]).pipe(
        filter(([, , active]) => active === true),
        map(([params, queryParams]) => ({ params, queryParams }))
      );
    }

    return combineLatest([route.params, route.queryParams]).pipe(
      map(([params, queryParams]) => ({ params, queryParams }))
    );
  }
}

/**
 * Server implementation:
 * emits route snapshot state once and completes.
 */
@Injectable()
export class ServerRouteStateSourceService extends RouteStateSourceService {
  get(
    route: ActivatedRoute,
    _active$?: Observable<boolean>
  ): Observable<RouteState> {
    return of({
      params: route.snapshot.params ?? {},
      queryParams: route.snapshot.queryParams ?? {}
    });
  }
}
