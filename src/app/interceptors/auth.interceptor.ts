import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from '@services/auth.service';
import { AUTH_ENABLED } from '@tokens/auth.tokens';

/**
 * Authentication interceptor.
 *
 * Behavior summary:
 * - No-op when auth feature is disabled.
 * - Adds `Authorization: Bearer <access_token>` only for requests targeting
 *   configured backend URLs, and only when request does not already provide
 *   an Authorization header.
 * - Never adds bearer token for `/auth/*` endpoints.
 * - On backend 401 (excluding `/auth/*`), attempts one refresh flow only when
 *   a refresh token is present and this interceptor had attached the original
 *   app access token.
 * - Requests that already provide an Authorization header never participate in
 *   the interceptor-managed refresh flow.
 * - If refresh fails with terminal auth failure, including post-refresh access
 *   token validation failure, expires the current session and redirects to
 *   `/login` while preserving the current safe internal route for one-time
 *   recovery after successful login.
 * - If backend 401 occurs with no refresh token and this interceptor had
 *   attached an access token to the original request, expires the current
 *   session and redirects to `/login` with the same route-preservation logic.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authEnabled = inject(AUTH_ENABLED);
  if (!authEnabled) {
    return next(req);
  }

  const router = inject(Router);
  const authService = inject(AuthService);
  const authToken = authService.getAccessToken();
  const isBackendRequest = authService.isRequestToConfiguredBackend(req.url);
  const isAuthEndpoint = isBackendRequest && authService.isRequestToAuthEndpoint(req.url);
  const hasAuthorizationHeader = req.headers.has('Authorization');
  const shouldAttachAccessToken = !!authToken && isBackendRequest && !isAuthEndpoint && !hasAuthorizationHeader;
  const shouldParticipateInRefreshFlow = shouldAttachAccessToken;
  let authReq = req;

  if (shouldAttachAccessToken) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${authToken}`
      }
    });
  }

  return next(authReq).pipe(
    catchError((err) => {
      const isBackendUnauthorized = err.status === 401 && isBackendRequest && !isAuthEndpoint;
      if (isBackendUnauthorized) {
        const hasRefreshToken = !!authService.getRefreshToken();
        if (hasRefreshToken && shouldParticipateInRefreshFlow) {
          return authService.refreshToken().pipe(
            switchMap((access_token) => {
              const newAuthReq = req.clone({
                setHeaders: {
                  Authorization: `Bearer ${access_token}`
                }
              });
              return next(newAuthReq);
            }),
            catchError((refreshError) => {
              if (isTerminalRefreshFailure(refreshError)) {
                redirectToLoginForReauthentication(router, authService);
              }
              return throwError(() => refreshError);
            })
          );
        }

        if (shouldParticipateInRefreshFlow) {
          redirectToLoginForReauthentication(router, authService);
        }
      }
      return throwError(() => err);
    })
  );
};

/**
 * Expires the current authenticated session and redirects to `/login` while
 * preserving the current safe internal route for one-time post-login recovery.
 */
function redirectToLoginForReauthentication(router: Router, authService: AuthService): void {
  const queryParams = authService.preserveReturnUrlForReauthentication(router.url);
  authService.expireSession();
  router.navigate(['/login'], {
    replaceUrl: true,
    queryParams
  });
}

function isTerminalRefreshFailure(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  return status === 401 || status === 422 || isPostRefreshSessionValidationFailure(error);
}

function isPostRefreshSessionValidationFailure(error: unknown): boolean {
  return (error as { postRefreshSessionValidationFailed?: unknown } | null)?.postRefreshSessionValidationFailed === true;
}
