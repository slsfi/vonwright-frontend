# Development

This document contains notes and tips on the development of the app.


## Run locally on Windows

### Remote Docker image of app

To locally run a prebuilt Docker image, which has been pushed to an image repository like GitHub Packages or DockerHub:

1. Start [Docker Desktop][docker_desktop] and log in with your credentials.
2. In PowerShell, `cd` into the app repository folder.
3. Run

```bash
docker run -it -p 4201:4201 --rm ghcr.io/slsfi/digital-edition-frontend-ng:main
```

where you should replace `ghcr.io/slsfi/digital-edition-frontend-ng:main` with the URL to the remote image you want to run.

4. Open your browser on <http://localhost:4201/>.

### Local Docker image of app

To first build and then run a Docker image of a local copy of the repository on your own machine:

1. Start [Docker Desktop][docker_desktop] and log in with your credentials.
2. In PowerShell, `cd` into the app repository folder.
3. Run

```bash
docker build -t digital-edition-frontend-ng:test .
```

(notice the dot at the end) to build the image from the current directory, where `digital-edition-frontend-ng:test` is the name and tag of the image. You can choose a different name and tag if you wish. Add `--no-cache` only when troubleshooting or when you want to force a fully fresh build.

4. Run

```bash
docker run -it -p 4201:4201 --rm digital-edition-frontend-ng:test
```

to run the image. If you built the image with a different name and tag in step 3, replace `digital-edition-frontend-ng:test` with your chosen `name:tag`.

5. Open your browser on <http://localhost:4201/>.

### nginx in front of app image

In production, nginx is run in a Docker container in front of the app container so nginx, which is more performant than Node.js, can server static files. To run the app in this setup locally:

1. Start [Docker Desktop][docker_desktop] and log in with your credentials.
2. In PowerShell, `cd` into the app repository folder.
3. Run

```bash
docker build -t digital-edition-frontend-ng:test .
```

(notice the dot at the end) to build the image from the current directory, where `digital-edition-frontend-ng:test` is the name and tag of the image. You can choose a different name and tag if you wish. Add `--no-cache` only when troubleshooting or when you want to force a fully fresh build.

4. Replace the URL of `image` in the `web` service in [`compose.yml`][docker_compose_file] with `digital-edition-frontend-ng:test` (or the `name:tag` you built the image with in step 3). **Do not commit this change!**
5. Run

```bash
docker compose up -d
```

6. Open your browser on <http://localhost:2089/> (the port of the nginx service defined in [`compose.yml`][docker_compose_file]).
7. Undo the changes in [`compose.yml`][docker_compose_file].
8. When you are done testing, stop the Docker containers in Docker Desktop and delete all containers and volumes that were created. Alternatively you can do this in the terminal by running

```bash
docker compose down --volumes
```



## Node.js version and building using GitHub Actions

The Node.js Docker-image tag can be passed as a build argument to `Dockerfile` using the argument `NODE_IMAGE_TAG`. `Dockerfile` sets a default value for the argument if it is not passed.

By default the app is built using GitHub Actions according to the workflow defined in `.github/workflows/docker-build-and-push.yml`, but you can also define your own build workflow. The workflow sets up a Docker Buildx builder using `docker/setup-buildx-action` and then runs the build with `docker/build-push-action` (BuildKit), passing `NODE_IMAGE_TAG` to `Dockerfile` and using `pull: true` so base image layers are refreshed by the builder.

The workflow also runs `docker pull node:${NODE_IMAGE_TAG}` before the build. This is intentional for explicitness and log visibility.

When updating which Node.js image is used for the build, remember to update both `docker-build-and-push.yml` and `Dockerfile`.



## Dependencies

The app is built on Angular and uses many web components from Ionic. It also has a few other essential dependencies, which are briefly described below.


### `@angular`

The Angular documentation is available on <https://angular.dev/>.

At it’s root, the Angular app uses NgModules, even though all components except `pages` use the standalone API. This is because currently, another dependency, `Ionic`, doesn’t support the Angular standalone API for SSR apps.

#### Updating Angular

Run

```bash
ng update @angular/cli @angular/core
```

For more detailed instructions see <https://angular.dev/cli/update>.

When updating to a new major version of Angular:

1. See the interactive [Angular update guide][angular_update_guide].
2. Update Angular dependencies in `package.json`/`package-lock.json` (for example via `ng update`). The Docker build installs dependencies from the lockfile using `npm ci`, so there is no separate Angular version argument in [`Dockerfile`][dockerfile] to update.


### `@ionic`

The Ionic Framework documentation is available on <https://ionicframework.com/docs/>

#### Updating Ionic

Run

```bash
npm install @ionic/angular @ionic/angular-server
```


### [`express`][npm_express]

Framework for running a web server in Node.js. This library is required by Angular to enable server-side rendering.

### [`express-rate-limit`][npm_express-rate-limit]

Middleware used for app-level request limiting of dynamic SSR/CSR shell responses in the Node server.


### [`htmlparser2`][npm_htmlparser2]

SSR-compatible HTML/XML parser, used in a few places in the app to parse HTML from the backend.


### [`ionicons`][npm_ionicons]

Iconset especially intended to be used with Ionic.


### [`marked`][npm_marked]

SSR-compatible Markdown parser. Parses Markdown to HTML. Any HTML in the Markdown is passed through as it is.


### [`marked-custom-heading-id`][npm_marked-custom-heading-id]

An extension to `marked` supporting adding custom ids to headings in the [Markdown Extended Syntax](https://www.markdownguide.org/extended-syntax/#heading-ids): `# heading {#custom-id}`.


### [`marked-footnote`][npm_marked-footnote]

An extension to `marked` supporting [GFM footnotes](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#footnotes) in Markdown.


### [`rxjs`][npm_rxjs]

Reactive extensions library. Used internally by Angular and heavily in the app for handling Observables.


### [`tslib`][npm_tslib]

Runtime library for TypeScript containing all of the TypeScript helper functions. Required by Angular.


### [`zone.js`][npm_zone.js]

Library for execution contexts (”zones”) that persist across async tasks. Required by Angular.


### [`browser-sync`][npm_browser-sync] (devDependency)

Required by the Angular builders.


### [`gzipper`][npm_gzipper] (devDependency)

Library for compressing files. Used in `Dockerfile` in a post-build step to create compressed (gzip) versions of static files. It’s configured in the `compress` script in `package.json`.


### [`ng-extract-i18n-merge`][npm_ng-extract-i18n-merge] (devDependency)

Library for extracting and merging i18n xliff translation files for Angular projects. This library extends the default Angular CLI, and is used to sort the keys in the xliff translation files. Used when running the `extract-i18n` script in `package.json` to create the xliff translation files for the app.


### `jasmine` and `karma`

Angular testing frameworks, not in use.



## Router preloading strategy

The app uses a platform-specific router preloading strategy:

- **Browser**: lazy routes are preloaded by default on good networks (when idle), unless route data overrides this behavior.
- **Server (SSR)**: no route preloading (`NoPreloading`).

Implementation files:

- [`src/app/services/router-preloading-strategy.service.ts`](../src/app/services/router-preloading-strategy.service.ts)
- [`src/app/app-routing.module.ts`](../src/app/app-routing.module.ts)
- [`src/app/app.routes.ts`](../src/app/app.routes.ts)
- [`src/app/app.routes.generated.ts`](../src/app/app.routes.generated.ts)
- [`src/app/app.module.ts`](../src/app/app.module.ts)
- [`src/app/app.server.module.ts`](../src/app/app.server.module.ts)

Route-level preload behavior is set with route `data.preload` in `app.routes.ts`:

- `'eager'`: preload as soon as router preloading runs.
- `'idle'`: preload when browser is idle.
- `'idle-if-fast'`: preload when browser is idle and network is considered good.
- missing: defaults to `'idle-if-fast'`.
- `'off'`: no preloading.

`'idle-if-fast'` currently means:

- do **not** preload if `navigator.connection.saveData === true`
- do **not** preload if `navigator.connection.effectiveType` is `slow-2g`, `2g`, or `3g`
- if `navigator.connection` is unavailable, preload is allowed

Current route policy:

- default for lazy routes: `idle-if-fast`
- optional per-route overrides: `eager`, `idle`, or `off`



## Feature-based route generation

The app can generate routes at build time based on values in [`src/assets/config/config.ts`](../src/assets/config/config.ts).

- Canonical routes source (edited by developers): [`src/app/app.routes.ts`](../src/app/app.routes.ts)
- Generated file: [`src/app/app.routes.generated.ts`](../src/app/app.routes.generated.ts)
- Generated auth-guarded route paths: [`src/app/auth-protected-route-paths.generated.ts`](../src/app/auth-protected-route-paths.generated.ts)
- Generator script: [`prebuild-generate-routes.js`](../prebuild-generate-routes.js)
- npm command: `npm run generate-routes`

Feature toggle in config:

- `app.prebuild.featureBasedRoutes` (default: `false`)
- when `false`, the generated routes include all default lazy routes
- when `true`, the generated routes include only feature-enabled lazy routes
- filtering is path-based in `prebuild-generate-routes.js`; any new route not listed in the filter map remains included by default

Build behavior:

- development builds/serve use `src/app/app.routes.ts` directly (all routes enabled)
- production builds replace `src/app/app.routes.ts` with `src/app/app.routes.generated.ts` using Angular `fileReplacements`
- `build:ssr` runs `generate-routes` explicitly before the production build

If you run production Angular CLI commands directly, run `npm run generate-routes` first.

Parser smoke tests:

- Test script: [`scripts/test-prebuild-generate-routes.js`](../scripts/test-prebuild-generate-routes.js)
- npm command: `npm run test:routes-parser`
- run these tests after changes to `prebuild-generate-routes.js` and after route syntax refactors in `src/app/app.routes.ts`



## Authentication-guarded routing and token-based authentication flow

Authentication support is optional and controlled by config. This is intended so the base app can stay auth-disabled by default, while selected forks can enable auth.

### Enable in a fork

1. Set `app.auth.enabled` to `true` in [`src/assets/config/config.ts`](../src/assets/config/config.ts).
2. Configure auth API base URL by setting `app.auth.backendAuthBaseURL`.
3. If `app.auth.backendAuthBaseURL` is missing, auth service falls back to the origin of `app.backendBaseURL` (for example `https://api.example.org/digitaledition` becomes `https://api.example.org/`).
4. Ensure backend exposes auth endpoints expected by frontend: `POST <backendAuthBaseURL>/auth/login` and `POST <backendAuthBaseURL>/auth/refresh`.
5. Protect routes by adding `canActivate: [authGuard]` in [`src/app/app.routes.ts`](../src/app/app.routes.ts) for the pages that require authentication.
6. For protected routes that do not normally fetch backend data (for example `/account`), add `data: { requiresSessionValidation: true }` so the guard can validate current session state through `GET <backendAuthBaseURL>/session/validate`.
7. Optional: configure `app.auth.sessionValidationTTLms` in [`src/assets/config/config.ts`](../src/assets/config/config.ts) to control how long a successful session validation is cached in the browser (default: `120000` ms).
8. Keep login route enabled with `canMatch: [authFeatureEnabledMatchGuard]` so `/login` is only matchable when auth feature is enabled.
9. If using production build with feature-based routes, run `npm run generate-routes` after route/config changes (or use `npm run build:ssr`, which runs it automatically).
In feature-based route mode, the `login` route is included only when `app.auth.enabled` is `true`.

### Behavior when disabled

- `AUTH_ENABLED` resolves to `false` from config.
- Auth guard is effectively a no-op.
- Auth interceptor is not registered in browser/server modules.
- `/login` is not matchable because `authFeatureEnabledMatchGuard` returns `false`.

### Redirect behavior and privacy hardening

- Unauthenticated access to protected routes redirects to `/login?rt=1`.
- Intended target URL is stored in session-scoped redirect storage (browser `sessionStorage`) and consumed once after successful login.
- If marker storage is unavailable (for example SSR), fallback uses legacy `returnUrl` query param.
- Redirect target validation requires all of the following: starts with `/`, does not start with `//`, does not target `/login`, is parseable by Angular router, and is at most 2000 characters.

### Interceptor and refresh hardening

- Bearer token is attached only to requests targeting configured backend URLs (`backendBaseURL` / `backendAuthBaseURL`).
- Bearer token is never attached to `/auth/*` endpoints.
- Refresh attempt is only made for backend 401 responses outside `/auth/*`.
- When a backend 401 occurs for a request that used a stored access token but no refresh token is available, the user is logged out and redirected to `/login`.
- `AuthService.refreshToken()` has defense-in-depth: if refresh token is missing, it fails fast, logs out, and skips network request.
- Routes with `data.requiresSessionValidation: true` trigger a guard-level call to `GET <backendAuthBaseURL>/session/validate`.
- Session validation is throttled and deduplicated in `AuthService.validateSessionIfStale()`:
  - successful validations are cached for `app.auth.sessionValidationTTLms` (default `120000` ms)
  - concurrent validations share one in-flight request
- Session validation `401` is treated as unauthenticated and redirects to `/login`; non-401 validation failures are fail-open.
- On app startup, `AuthService` treats a stored session as authenticated only when both `access_token` and `refresh_token` exist; partial token state is cleared.

### Manual auth regression checklist (JWT expiry/invalidation)

Use this checklist after auth/interceptor/guard changes.

- Preconditions: `app.auth.enabled = true`, backend auth endpoints enabled, and at least one protected content route available (for example `/collection/:collectionID/text`).
- Use browser DevTools to inspect/edit local storage keys: `access_token`, `refresh_token`, `auth_email`.

1. Logged-out baseline: clear all three keys and open `/account`. Expected result: redirect to `/login`.
2. Happy-path login: log in and open `/account`. Expected result: account page is accessible and protected content routes load normally.
3. Partial stale state: keep only `access_token` in local storage (remove `refresh_token` and `auth_email`), then reload and open `/account`. Expected result: app clears stale state and redirects to `/login`.
4. Backend-invalidated session with both tokens present: keep both tokens in local storage, invalidate them in backend, then open a protected route that performs backend requests (for example `/collection/:collectionID/text`). Expected result: first backend 401 triggers logout and redirect to `/login`.
5. Expired access token but valid refresh token: force backend to return 401 for access token while refresh still works, then open protected content. Expected result: one refresh attempt is made, request is retried, and user remains logged in.
6. Invalid refresh token: force backend to return 401 for refresh, then open protected content. Expected result: user is logged out and redirected to `/login`.
7. Backend-invalidated session on a protected route that does not fetch backend data: keep both tokens in local storage, invalidate session in backend, then open a route with `data.requiresSessionValidation: true` (for example `/account`). Expected result: guard session validation returns 401 and redirects to `/login`.

### SSR note

With current token storage strategy (no auth cookies), SSR cannot identify authenticated browser users on initial request.

To avoid SSR/client mismatches on auth-guarded routes, the Express SSR server serves the client-rendered index HTML (CSR shell) for route paths generated in [`src/app/auth-protected-route-paths.generated.ts`](../src/app/auth-protected-route-paths.generated.ts) when `app.auth.enabled` is `true`. Non-protected routes continue to use SSR.

### Sitemap behavior in auth mode

- Auth-related routes are always excluded from sitemap generation.
  - In current generator rules this includes `/login`, `/account`, `/forgot-password`, `/reset-password`, `/change-password`, `/register`, and `/verify-email`.
- When `app.auth.enabled` is `true`, auth-protected routes are also excluded from sitemap generation.
  - In current generator rules this includes collection routes, `index/:type`, `media-collection`, and `search`.

### Static collection menus in auth mode

- When `app.auth.enabled` is `true`, `prebuild-generate-static-collection-menus.js` skips generating static collection TOC HTML fragments.
- `StaticHtmlComponent` also forces prebuilt collection menus off in auth mode, even if `app.prebuild.staticCollectionMenus` is `true` or missing.


## TODOs

Use this section for cross-cutting TODOs that should stay visible outside local code comments.

### SSR route mode migration

Current status:

- Auth-protected routes are currently forced to client rendering in Express middleware in [`server.ts`](../server.ts), based on generated route-path metadata from [`src/app/auth-protected-route-paths.generated.ts`](../src/app/auth-protected-route-paths.generated.ts).
- This is an implementation workaround for the current webpack-based SSR build setup.

When migrating to Angular's `application` builder (`@angular-devkit/build-angular:application`):

- Investigate replacing the current middleware-based implementation with Angular server-routes configuration (`withRoutes` / `RenderMode.Client`) for auth-protected routes.
- Validate compatibility with feature-based route generation before removing the current workaround.

### nginx rate limiting for SSR backend

- nginx rate limiting is currently not enabled; app-level limiting is handled in `server.ts` (`express-rate-limit`).
- Consider re-enabling nginx edge rate limiting later for defense in depth.
- Why postponed: correct per-user limiting in nginx depends on verified real client IP forwarding/trust configuration across proxy chain(s) (for example LB/HAProxy/nginx). A wrong config can collapse many users into one bucket or trust spoofable headers.

### Hydration migration

Current status:

- Client hydration is not enabled in this app right now (Ionic SSR limitation).
- `ngSkipHydration` is used only on Angular component hosts, never on plain HTML elements.
- Facsimile image viewers are explicitly marked with `ngSkipHydration` as a temporary safeguard.
- Media-collection thumbnails are also resolved through `FacsimileImageService`; in auth-enabled mode, browser `src` can become a blob URL after bootstrap.

Current temporary markers:

- [`src/app/components/collection-text-types/facsimiles/facsimiles.component.ts`](../src/app/components/collection-text-types/facsimiles/facsimiles.component.ts)
- [`src/app/dialogs/modals/fullscreen-image-viewer/fullscreen-image-viewer.modal.ts`](../src/app/dialogs/modals/fullscreen-image-viewer/fullscreen-image-viewer.modal.ts)
- [`src/app/components/gallery-thumb-image/gallery-thumb-image.component.ts`](../src/app/components/gallery-thumb-image/gallery-thumb-image.component.ts)
- [`src/app/app.component.html`](../src/app/app.component.html) (auth-enabled mode: `top-menu` and `main-side-menu` are marked with `ngSkipHydration`)

Related implementation notes:

- [`src/app/components/collection-text-types/facsimiles/facsimiles.component.ts`](../src/app/components/collection-text-types/facsimiles/facsimiles.component.ts)
- [`src/app/dialogs/modals/fullscreen-image-viewer/fullscreen-image-viewer.modal.ts`](../src/app/dialogs/modals/fullscreen-image-viewer/fullscreen-image-viewer.modal.ts)
- [`src/app/components/gallery-thumb-image/gallery-thumb-image.component.ts`](../src/app/components/gallery-thumb-image/gallery-thumb-image.component.ts)
- [`src/app/pages/media-collection/media-collection.page.ts`](../src/app/pages/media-collection/media-collection.page.ts)

Why:

- In auth-enabled mode, browser rendering may replace URL-based image `src` values with blob URLs after bootstrap.
- If hydration is enabled later, this can cause SSR/client DOM differences unless initial `src` is deterministic.
- This also applies to media-collection thumbnail images resolved via `FacsimileImageService`.

Exit criteria:

1. Hydration is enabled in the app.
2. Facsimile and media-collection image `src` initialization is made hydration-safe (deterministic SSR/client initial value).
3. Remove `ngSkipHydration` markers and remove/update the local TODO comments above.



## SSR smoke test (local or remote)

Use the SSR smoke test to verify that selected routes return expected server-rendered HTML in the initial response.

- Test script: [`scripts/test-ssr-smoke.js`](../scripts/test-ssr-smoke.js)
- npm command: `npm run test:ssr:smoke`
- Default base URL: `http://localhost:4201`

Recommended workflow:

1. Build and start the SSR app:

```bash
npm run build:ssr
npm run serve:ssr
```

2. In another terminal, run:

```bash
npm run test:ssr:smoke
```

Optional arguments:

- `--base-url=<url>` to target another host/port (including remote environments).
- `--timeout-ms=<number>` to change per-request timeout.

Example:

```bash
npm run test:ssr:smoke -- --base-url=http://localhost:4201 --timeout-ms=5000
```

What the smoke test validates per route:

- HTTP status is `200`.
- `Content-Type` contains `text/html`.
- Expected SSR HTML snippets or patterns are present in the raw response body.
- Optional per-test request headers can be set in `TEST_CASES` (for example to simulate forwarded HTTPS headers).

Updating checks:

- Edit `TEST_CASES` in [`scripts/test-ssr-smoke.js`](../scripts/test-ssr-smoke.js) when expected content changes.
- Prefer deterministic snippets that are stable across builds.
- Use regex checks only when HTML attribute order can vary.



## SSR benchmark (localhost)

Use the SSR benchmark to measure response-time performance of server-rendered routes (cold and warm runs).

- Test script: [`scripts/benchmark-ssr.js`](../scripts/benchmark-ssr.js)
- npm commands: `npm run bench:ssr`, `npm run bench:ssr:build`
- Default base URL: `http://127.0.0.1:4201`

Recommended workflow:

1. Build and run benchmark in one command:

```bash
npm run bench:ssr:build
```

2. Or, if you already built SSR output, run only the benchmark:

```bash
npm run bench:ssr
```

3. Or benchmark an already running SSR server:

```bash
npm run bench:ssr -- --skip-start --base-url=http://127.0.0.1:4201
```

Optional arguments:

- `--warm-runs=<number>` (or `--runs=<number>`) to set warm requests per route.
- `--route=<path>` or `--routes=<comma,separated,paths>` to target specific routes.
- `--port=<number>` to set the auto-started server port.
- `--base-url=<url>` to target another host/port.
- `--startup-timeout-ms=<number>` to adjust server startup wait time.
- `--request-timeout-ms=<number>` to adjust per-request timeout.
- `--skip-start` to benchmark without starting `dist/app/proxy-server.js`.

Example:

```bash
npm run bench:ssr -- --warm-runs=8 --routes=/sv/,/sv/collection/216/text/20280
```

What the benchmark reports:

- Per-request timing table with status, elapsed milliseconds, and response size.
- Cold run summary (run 1 per route).
- Warm run summary with `avg`, `median`, `p95`, `min`, and `max`.




[angular_update_guide]: https://update.angular.io/
[docker_compose_file]: ../compose.yml
[docker_desktop]: https://www.docker.com/products/docker-desktop/
[dockerfile]: ../Dockerfile
[npm_epubjs]: https://www.npmjs.com/package/epubjs
[npm_express]: https://www.npmjs.com/package/express
[npm_express-rate-limit]: https://www.npmjs.com/package/express-rate-limit
[npm_htmlparser2]: https://www.npmjs.com/package/htmlparser2
[npm_ionicons]: https://www.npmjs.com/package/ionicons
[npm_marked]: https://www.npmjs.com/package/marked
[npm_marked-custom-heading-id]: https://www.npmjs.com/package/marked-custom-heading-id
[npm_marked-footnote]: https://www.npmjs.com/package/marked-footnote
[npm_rxjs]: https://www.npmjs.com/package/rxjs
[npm_tslib]: https://www.npmjs.com/package/tslib
[npm_zone.js]: https://www.npmjs.com/package/zone.js
[npm_browser-sync]: https://www.npmjs.com/package/browser-sync
[npm_gzipper]: https://www.npmjs.com/package/gzipper
[npm_ng-extract-i18n-merge]: https://www.npmjs.com/package/ng-extract-i18n-merge
