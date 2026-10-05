# Authentication

The app supports optional authentication-guarded routing and a token-based authentication flow. Authentication is controlled by config so the base app can stay auth-disabled by default, while selected forks can enable it.

## Enable in a fork

1. Set `app.auth.enabled` to `true` in [`src/assets/config/config.ts`](../src/assets/config/config.ts).
2. Configure auth API base URL by setting `app.auth.backendAuthBaseURL`.
3. If `app.auth.backendAuthBaseURL` is missing, auth service falls back to the origin of `app.backendBaseURL` (for example `https://api.example.org/digitaledition` becomes `https://api.example.org/`).
4. Ensure backend exposes auth endpoints expected by frontend: `POST <backendAuthBaseURL>/auth/login`, `POST <backendAuthBaseURL>/auth/refresh`, and `GET <backendAuthBaseURL>/session/validate`.
5. Protect routes by adding `canActivate: [authGuard]` to the route declaration that owns the protected URL. This is normally the top-level route in [`src/app/app.routes.ts`](../src/app/app.routes.ts); child-specific guards belong in the corresponding lazy `*.routes.ts` file.
6. For protected routes that do not normally fetch backend data (for example `/account`), add `data: { requiresSessionValidation: true }` so the guard can validate current session state through `GET <backendAuthBaseURL>/session/validate`.
7. Optional: configure `app.auth.sessionValidationTTLms` in [`src/assets/config/config.ts`](../src/assets/config/config.ts) to control how long a successful session validation is cached in the browser (default: `120000` ms).
8. Keep login route enabled with `canMatch: [authFeatureEnabledMatchGuard]` so `/login` is only matchable when auth feature is enabled.
9. If using production build with feature-based routes, run `npm run generate-routes` after route/config changes (or use `npm run build:ssr`, which runs it automatically).

In feature-based route mode, the `login` route is included only when `app.auth.enabled` is `true`.

## Behavior when disabled

- `AUTH_ENABLED` resolves to `false` from config.
- Auth guard is effectively a no-op.
- The auth interceptor is not registered in the shared application configuration.
- `/login` is not matchable because `authFeatureEnabledMatchGuard` returns `false`.

## Redirect behavior and privacy hardening

- Unauthenticated access to protected routes redirects to `/login?rt=1`.
- Intended target URL is stored in session-scoped redirect storage (browser `sessionStorage`) and consumed once after successful login.
- If marker storage is unavailable (for example SSR), fallback uses legacy `returnUrl` query param.
- Redirect target validation requires all of the following: starts with `/`, does not start with `//`, does not target `/login`, is parseable by Angular router, and is at most 2000 characters.

## Startup session validation

- On app startup, `AuthService` checks persisted token state before trusting it.
- If either `access_token` or `refresh_token` is missing, auth state is cleared. This removes partial token state and leaves the user unauthenticated.
- If both tokens exist, `AuthService` creates one one-time bootstrap validation request to `GET <backendAuthBaseURL>/session/validate` using the stored access token as the bearer token.
- The in-memory authenticated state remains false until that startup validation succeeds.
- The route guard waits for pending startup validation before allowing a protected route or redirecting to `/login`. This is a bootstrap check, not route-guard polling on every navigation.
- If startup validation succeeds, the session is accepted, authenticated email is restored from storage, and protected routes can activate.
- If the stored access token is stale and startup validation returns a terminal auth failure (`401` or `422`), the app may refresh the access token once with `POST <backendAuthBaseURL>/auth/refresh`.
- The refreshed access token must also pass `GET <backendAuthBaseURL>/session/validate` before the startup session is accepted.
- If startup validation or the one refresh attempt fails, auth state is cleared and the user remains unauthenticated.

## Interceptor and refresh hardening

- Bearer token is attached only to requests targeting configured backend URLs (`backendBaseURL` / `backendAuthBaseURL`).
- Bearer token is never attached to `/auth/*` endpoints.
- Refresh attempt is only made for backend 401 responses outside `/auth/*`.
- When a backend 401 occurs for a request that used a stored access token but no refresh token is available, the user is logged out and redirected to `/login`.
- `AuthService.refreshToken()` has defense-in-depth: if refresh token is missing, it fails fast, logs out, and skips network request.
- Refreshed access tokens are validated with `GET <backendAuthBaseURL>/session/validate` before they are stored, emitted to concurrent refresh callers, or used for request retry.
- Routes with `data.requiresSessionValidation: true` trigger a guard-level call to `GET <backendAuthBaseURL>/session/validate`.
- Session validation is throttled and deduplicated in `AuthService.validateSessionIfStale()`:
  - successful validations are cached for `app.auth.sessionValidationTTLms` (default `120000` ms)
  - concurrent validations share one in-flight request
- Session validation `401` and `422` responses are treated as unauthenticated and redirect to `/login`; other guard-level validation probe failures are fail-open.

## Manual auth regression checklist (JWT expiry/invalidation)

Use this checklist after auth/interceptor/guard changes.

- Preconditions: `app.auth.enabled = true`, backend auth endpoints enabled, and at least one protected content route available (for example `/collection/:collectionID/text`).
- Use browser DevTools to inspect/edit local storage keys: `access_token`, `refresh_token`, `auth_email`.

1. Logged-out baseline: clear all three keys and open `/account`. Expected result: redirect to `/login`.
2. Happy-path login: log in and open `/account`. Expected result: account page is accessible and protected content routes load normally.
3. Partial stale state: keep only `access_token` in local storage (remove `refresh_token` and `auth_email`), then reload and open `/account`. Expected result: app clears stale state and redirects to `/login`.
4. Startup validation with existing tokens: log in, open DevTools with network preservation enabled, then hard refresh on a protected route. Expected result: app calls `/session/validate` before treating the user as authenticated, then allows the route after validation succeeds.
5. Startup validation with stale access token: keep both tokens in local storage, make the stored access token stale while refresh still works, then hard refresh on a protected route. Expected result: first `/session/validate` fails, one refresh attempt is made, the refreshed access token is validated with `/session/validate`, and the route activates only after validation succeeds.
6. Backend-invalidated session with both tokens present: keep both tokens in local storage, invalidate them in backend, then open a protected route that performs backend requests (for example `/collection/:collectionID/text`). Expected result: startup validation or the first backend 401 clears auth state and redirects to `/login`.
7. Expired access token but valid refresh token during normal API use: force backend to return 401 for access token while refresh still works, then open protected content. Expected result: one refresh attempt is made, the refreshed access token is validated, the request is retried, and user remains logged in.
8. Refresh returns an access token that fails `/session/validate`: force the validation endpoint to reject the refreshed token. Expected result: refreshed token is not stored, user is logged out, and browser redirects to `/login`.
9. Invalid refresh token: force backend to return 401 for refresh, then open protected content. Expected result: user is logged out and redirected to `/login`.
10. Backend-invalidated session on a protected route that does not fetch backend data: keep both tokens in local storage, invalidate session in backend, then open a route with `data.requiresSessionValidation: true` (for example `/account`). Expected result: guard session validation returns 401 and redirects to `/login`.

## SSR note

With current token storage strategy (no auth cookies), SSR cannot identify authenticated browser users on initial request.

To avoid SSR/client mismatches on auth-guarded routes, the Express SSR server serves the client-rendered index HTML (CSR shell) for route paths generated in [`src/app/auth-protected-route-paths.generated.ts`](../src/app/auth-protected-route-paths.generated.ts) when `app.auth.enabled` is `true`. Non-protected routes continue to use SSR.

## Sitemap behavior in auth mode

- Auth-related routes are always excluded from sitemap generation.
  - In current generator rules this includes `/login`, `/account`, `/forgot-password`, `/reset-password`, `/change-password`, `/register`, and `/verify-email`.
- When `app.auth.enabled` is `true`, auth-protected routes are also excluded from sitemap generation.
  - In current generator rules this includes collection routes, `index/:type`, `media-collection`, and `search`.

## Static collection menus in auth mode

- When `app.auth.enabled` is `true`, `prebuild-generate-static-collection-menus.js` skips generating static collection TOC HTML fragments.
- `StaticHtmlComponent` also forces prebuilt collection menus off in auth mode, even if `app.prebuild.staticCollectionMenus` is `true` or missing.
