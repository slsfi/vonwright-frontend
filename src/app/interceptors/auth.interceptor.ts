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
 *   a refresh token is present.
 * - Refresh retry always sets `Authorization: Bearer <new_access_token>` on the
 *   retried request, overriding any previous Authorization header value.
 * - If refresh fails with 401, logs out and redirects to `/login`.
 * - If backend 401 occurs with no refresh token and this interceptor had
 *   attached an access token to the original request, logs out and redirects to
 *   `/login`.
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
        if (hasRefreshToken) {
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
              if (refreshError.status === 401) {
                authService.logout();
                router.navigate(['/login'], { replaceUrl: true });
              }
              return throwError(() => refreshError);
            })
          );
        }

        if (shouldAttachAccessToken) {
          authService.logout();
          router.navigate(['/login'], { replaceUrl: true });
        }
      }
      return throwError(() => err);
    })
  );
};
