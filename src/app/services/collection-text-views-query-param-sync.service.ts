import { Location } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';


/**
 * Synchronizes the `views` query param for the collection text page.
 *
 * Why this abstraction exists:
 * - Browser: we keep the URL updated with the current view state.
 * - Server (SSR): we must avoid route churn caused by query-param writes
 *   during render, since that can trigger extra route-processing cycles.
 *
 * Platform modules provide different implementations:
 * - `AppModule` -> browser implementation
 * - `AppServerModule` -> server no-op implementation
 */
export abstract class CollectionTextViewsQueryParamSyncService {
  /**
   * Updates the URL query param `views`.
   * @param viewsParam Encoded value for the `views` query param.
   * @param route Route used as relative base for URL updates.
   * @param silent If true, replace URL without navigation.
   */
  abstract update(
    viewsParam: string | undefined,
    route: ActivatedRoute,
    silent: boolean
  ): void;
}

/**
 * Browser implementation:
 * - `silent = true`: replace URL without triggering a navigation.
 * - `silent = false`: navigate with merged query params.
 */
@Injectable()
export class BrowserCollectionTextViewsQueryParamSyncService
  extends CollectionTextViewsQueryParamSyncService {
  private location = inject(Location);
  private router = inject(Router);

  update(
    viewsParam: string | undefined,
    route: ActivatedRoute,
    silent: boolean
  ): void {
    if (silent) {
      // Build a UrlTree, then replace the URL WITHOUT navigating.
      const tree = this.router.createUrlTree([], {
        relativeTo: route,
        queryParams: { views: viewsParam },
        queryParamsHandling: 'merge',
      });

      // This updates the address bar (like replaceUrl) but does
      // NOT fire a new navigation.
      this.location.replaceState(this.router.serializeUrl(tree));
      return;
    }

    this.router.navigate([], {
      relativeTo: route,
      queryParams: { views: viewsParam },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }
}

/**
 * Server implementation:
 * intentionally no-op during SSR to prevent URL write side effects from
 * causing extra route processing while rendering.
 */
@Injectable()
export class ServerCollectionTextViewsQueryParamSyncService
  extends CollectionTextViewsQueryParamSyncService {
  update(
    _viewsParam: string | undefined,
    _route: ActivatedRoute,
    _silent: boolean
  ): void {
    // No-op on the server to avoid route churn during SSR.
  }
}
