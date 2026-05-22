import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router, UrlTree } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';

import {
  AuthRedirectStorageService
} from '@services/auth-redirect-storage.service';
import {
  createLoginRedirectQueryParams,
  isLoginRouteURL,
  resolveLoginRouteRedirectURL
} from '@services/auth-redirect-url.utils';
import { isTerminalSessionValidationFailure } from '@services/auth-error.utils';
import { AuthService } from '@services/auth.service';
import { AUTH_ENABLED } from '@tokens/auth.tokens';

/**
 * Route guard for authentication-gated pages.
 *
 * Behavior:
 * - Restored token state is validated once at startup before route decisions.
 * - Authenticated users can access protected routes.
 * - For protected routes with `data.requiresSessionValidation === true`, the guard
 *   validates server-side session state before allowing navigation.
 * - Unauthenticated users are redirected to `/login` with a short marker query
 *   param, and intended target URL is stored in session-scoped storage.
 * - If marker storage is unavailable (for example SSR), guard falls back to
 *   legacy `returnUrl` query parameter.
 * - Authenticated users trying to open `/login` are redirected to stored target
 *   URL (when marker is present) or legacy `returnUrl`, otherwise to `/`.
 * - Session validation 401/422 errors are treated as unauthenticated and
 *   redirect to `/login`; other probe errors are fail-open (navigation is
 *   allowed).
 * - If `AUTH_ENABLED` is false, guard is a no-op and always allows.
 *
 * Auth state is read after any startup validation has completed, with optional
 * async server validation on routes that opt in.
 *
 * Redirects are returned as UrlTrees (instead of imperative navigation),
 * which is the recommended Angular guard pattern.
 */
export const authGuard: CanActivateFn = (route, state) => {
  const authEnabled = inject(AUTH_ENABLED);
  if (!authEnabled) {
    return true;
  }

  const authService = inject(AuthService);
  const router = inject(Router);
  const authRedirectStorage = inject(AuthRedirectStorageService);
  const isLoginRoute = isLoginRouteURL(state.url);

  return authService.waitForStartupValidation().pipe(
    switchMap(() => {
      const isAuthenticated = authService.isAuthenticated();

      if (isLoginRoute) {
        if (!isAuthenticated) {
          return of(true); // User is not authenticated, allow access to login
        }

        const loginRouteRedirectURL = resolveLoginRouteRedirectURL(router, authRedirectStorage, state.url);
        return of(loginRouteRedirectURL
          ? router.parseUrl(loginRouteRedirectURL) // User is authenticated, redirect to requested route when available
          : router.createUrlTree(['/'])); // User is authenticated, redirect to home and block the route
      }

      if (isAuthenticated) {
        if (!requiresSessionValidation(route)) {
          return of(true); // User is authenticated, allow access
        }

        return authService.validateSessionIfStale().pipe(
          map(() => true),
          catchError((error) => {
            if (isTerminalSessionValidationFailure(error)) {
              return of(createLoginRedirectUrlTree(router, authRedirectStorage, state.url));
            }

            // Fail-open for transient probe failures (network/backend errors).
            return of(true);
          })
        );
      }

      return of(createLoginRedirectUrlTree(router, authRedirectStorage, state.url));
    }),
    catchError(() => of(isLoginRoute
      ? true
      : createLoginRedirectUrlTree(router, authRedirectStorage, state.url)
    ))
  );
};

function requiresSessionValidation(route: ActivatedRouteSnapshot): boolean {
  return route.data?.['requiresSessionValidation'] === true;
}

function createLoginRedirectUrlTree(
  router: Router,
  authRedirectStorage: AuthRedirectStorageService,
  targetUrl: string
): UrlTree {
  return router.createUrlTree(['/login'], {
    queryParams: createLoginRedirectQueryParams(router, authRedirectStorage, targetUrl)
  });
}
