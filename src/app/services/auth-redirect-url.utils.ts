import { Router } from '@angular/router';

import {
  AuthRedirectStorageService,
  AUTH_REDIRECT_MARKER_QUERY_PARAM,
  AUTH_REDIRECT_MARKER_VALUE
} from '@services/auth-redirect-storage.service';

const MAX_RETURN_URL_LENGTH = 2000;
const GUEST_AUTH_ROUTE_PREFIXES = ['/login', '/register'];

type QueryParams = Record<string, unknown>;

export function isLoginRouteURL(url: string): boolean {
  return GUEST_AUTH_ROUTE_PREFIXES.some((prefix) =>
    url === prefix ||
    url.startsWith(`${prefix}?`) ||
    url.startsWith(`${prefix}/`)
  );
}

export function getSafeInternalRedirectURL(router: Router, value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  if (!value.startsWith('/') || value.startsWith('//')) {
    return null;
  }

  if (isLoginRouteURL(value)) {
    return null;
  }

  if (value.length > MAX_RETURN_URL_LENGTH) {
    return null;
  }

  try {
    router.parseUrl(value);
  } catch {
    return null;
  }

  return value;
}

export function resolveRedirectFromMarker(
  router: Router,
  authRedirectStorage: Pick<AuthRedirectStorageService, 'consumeReturnUrl'>,
  currentUrl: string
): string | null {
  const queryParams = getQueryParams(router, currentUrl);
  if (!queryParams) {
    return null;
  }

  const markerValue = queryParams[AUTH_REDIRECT_MARKER_QUERY_PARAM];
  if (!hasRedirectMarker(markerValue)) {
    return null;
  }

  const storedReturnURL = authRedirectStorage.consumeReturnUrl();
  return getSafeInternalRedirectURL(router, storedReturnURL);
}

export function resolveReturnUrlFromQuery(router: Router, currentUrl: string): string | null {
  const queryParams = getQueryParams(router, currentUrl);
  if (!queryParams) {
    return null;
  }

  return getSafeInternalRedirectURL(router, queryParams['returnUrl']);
}

export function resolveLoginRouteRedirectURL(
  router: Router,
  authRedirectStorage: Pick<AuthRedirectStorageService, 'consumeReturnUrl'>,
  currentUrl: string
): string | null {
  const queryParams = getQueryParams(router, currentUrl);
  if (!queryParams) {
    return null;
  }

  const markerValue = queryParams[AUTH_REDIRECT_MARKER_QUERY_PARAM];
  if (hasRedirectMarker(markerValue)) {
    const storedReturnURL = authRedirectStorage.consumeReturnUrl();
    const safeStoredReturnURL = getSafeInternalRedirectURL(router, storedReturnURL);
    if (safeStoredReturnURL) {
      return safeStoredReturnURL;
    }
  }

  return getSafeInternalRedirectURL(router, queryParams['returnUrl']);
}

/**
 * Builds query params for redirecting to a guest auth route while preserving a
 * safe post-login target when possible.
 *
 * Stored marker-based redirects take precedence when session storage is
 * available; otherwise the helper falls back to the legacy `returnUrl` query
 * parameter. Any previously stored redirect target is cleared first so stale
 * values cannot leak into later auth flows.
 */
export function createLoginRedirectQueryParams(
  router: Router,
  authRedirectStorage: Pick<AuthRedirectStorageService, 'storeReturnUrl' | 'clearReturnUrl'>,
  targetUrl: string
): QueryParams | undefined {
  const safeTargetURL = getSafeInternalRedirectURL(router, targetUrl);
  authRedirectStorage.clearReturnUrl();

  if (safeTargetURL && authRedirectStorage.storeReturnUrl(safeTargetURL)) {
    return {
      [AUTH_REDIRECT_MARKER_QUERY_PARAM]: AUTH_REDIRECT_MARKER_VALUE
    };
  }

  return safeTargetURL ? { returnUrl: safeTargetURL } : undefined;
}

export function getAuthRedirectNavigationQueryParams(router: Router, currentUrl: string): QueryParams {
  const queryParams = getQueryParams(router, currentUrl);
  if (!queryParams) {
    return {};
  }

  const navigationQueryParams: QueryParams = {};
  const markerValue = queryParams[AUTH_REDIRECT_MARKER_QUERY_PARAM];
  if (hasRedirectMarker(markerValue)) {
    navigationQueryParams[AUTH_REDIRECT_MARKER_QUERY_PARAM] = AUTH_REDIRECT_MARKER_VALUE;
  }

  const safeReturnUrl = getSafeInternalRedirectURL(router, queryParams['returnUrl']);
  if (safeReturnUrl) {
    navigationQueryParams['returnUrl'] = safeReturnUrl;
  }

  return navigationQueryParams;
}

function hasRedirectMarker(value: unknown): boolean {
  return value === AUTH_REDIRECT_MARKER_VALUE;
}

function getQueryParams(router: Router, currentUrl: string): QueryParams | null {
  try {
    return (router.parseUrl(currentUrl).queryParams ?? {}) as QueryParams;
  } catch {
    return null;
  }
}
