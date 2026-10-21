# Base-app development

This guide contains architecture notes, implementation details, and development/testing tips for contributors to the shared base app.

For edition settings, feature selection, assets, languages, and styling, use the [project customization guide](PROJECT-CUSTOMIZATION.md). Build/release operations belong in [deployment](DEPLOYMENT.md); release-specific fork migration steps belong in [breaking changes and fork migration notes](breaking-changes/).

## Application architecture

The app is a standalone, zoneless Angular application with server-side rendering and Ionic UI components.

- **Standalone Angular application:** [`src/main.ts`](../src/main.ts) and [`src/main.server.ts`](../src/main.server.ts) both bootstrap `AppComponent` with `bootstrapApplication()`. There are no application, server, page, or routing NgModules owned by this repository; page templates and reusable components import their Angular and Ionic dependencies directly.
- **Browser/server bootstrap and shared provider configuration:** The browser bootstrap uses [`src/app/app.config.ts`](../src/app/app.config.ts), while the server bootstrap uses [`src/app/app.config.server.ts`](../src/app/app.config.server.ts). The browser configuration owns shared router, HTTP, Ionic, and application providers and selects browser implementations of platform-specific services. The server configuration uses `mergeApplicationConfig()` so server-only providers are applied after the shared browser configuration and override the platform-specific browser implementations.
- **Service provisioning:** Shared root services use Angular's `@Service()` decorator. Browser/server implementations use `@Service({ autoProvided: false })` and are selected explicitly through the application configurations' `useClass` providers. Keep automatic provisioning disabled for those implementations so platform selection stays with the application configuration.
- **Ionic standalone components and the `IonicServerModule` bridge:** Application components import the standalone Ionic components they use rather than `IonicModule`, and application-level Ionic providers are registered with `provideIonicAngular()`. On the server, `importProvidersFrom(IonicServerModule)` is the sole intentional application-level NgModule bridge because Ionic does not expose an equivalent standalone server-provider function.
- **Zoneless change detection:** The application uses Angular's zoneless change detection and does not register `provideZoneChangeDetection()` or another change-detection compatibility provider. Components expose asynchronous template state through signals, inputs, the `async` pipe, or other Angular notification mechanisms. Zone.js is absent from browser, server, and test polyfills and from the dependency tree.
- **SSR via `AngularNodeAppEngine`:** [`src/server.ts`](../src/server.ts) contains Express app creation, middleware setup, the Angular handler, and the CLI's exported Node request handler. Its `configureSsrMiddleware` and `staticFiles` helpers keep proxy handling, static files, fast 404s, and the DevTools probe ahead of the SSR limiter and Angular. The default locale's static router is shared by its locale-prefixed and unprefixed mounts. Locale paths come from `angular.json` and are matched against the emitted browser directories. Unprefixed requests prefer `app.i18n.defaultLanguage`, defaulting to the first configured interface language (or `sv` if none). If that language was not emitted, they use the first emitted locale. `Accept-Language` does not select the locale.
- **Application request context:** Application services optionally inject [`APPLICATION_REQUEST_CONTEXT`](../src/app/tokens/request-context.token.ts) for the app-relative request URL, resolved public origin, and user agent. The [server adapter](../src/ssr/server-request-context.ts) reads Angular's nullable Web `REQUEST` and strips the rendered document's base path, preserving query parameters and escaped characters. Proxy headers are resolved at the Express boundary, not reinterpreted in application services. Browser services retain their router, document-location, and navigator fallbacks. Keep adapters under `src/ssr/`. `PageNotFoundPage` sets HTTP 404 through Angular's nullable `RESPONSE_INIT`.
- **Integrated application builder and `dist/app` contract:** [`angular.json`](../angular.json) uses `@angular/build:application` for one browser/server build, `@angular/build:dev-server` for development, and `@angular/build:unit-test` for Vitest unit tests with jsdom. Production emits `dist/app/browser/<subPath>/index.csr.html`, localized server bundles, and `dist/app/server/server.mjs`; `npm run serve:ssr` starts that ESM entry on port 4201 (or `PORT`). Production retains `inlineCritical: false`.
- **Generated server-rendering modes:** [`app.config.server.ts`](../src/app/app.config.server.ts) registers generated routes through `provideServerRendering(withRoutes(serverRoutes))`. With auth enabled, protected routes and their lazy descendants use `RenderMode.Client`; public routes use `RenderMode.Server`. With auth disabled, normal application routes use SSR and auth-only routes return application 404s. The final `**` server route uses `RenderMode.Server`. Angular prerendering is not configured; generated collection-menu HTML remains a separate prebuild step. See [route generation](#feature-based-route-generation).
- **Public files and compiled project inputs:** [`public/`](../public/) is copied into each emitted locale's browser output. Configuration and global overrides remain compiled inputs under `src/project/`, with shared style inclusions in [`src/styles.scss`](../src/styles.scss). Sass font references produce hashed files under `media/`; copied `assets/...` URLs and root crawler-document URLs remain stable. See [theming](THEMING.md) and the [production output layout](DEPLOYMENT.md#building).
- **TypeScript configuration:** [`tsconfig.json`](../tsconfig.json) shares TypeScript and Angular compiler settings, with an empty `files` list and references to the application and test configurations. [`tsconfig.app.json`](../tsconfig.app.json) includes browser and server sources, excludes specs and the Vitest cleanup setup, and supplies Node/localization types. [`tsconfig.spec.json`](../tsconfig.spec.json) supplies Vitest globals and localization types. Shared settings rely on TypeScript 6 defaults for strict checks, including property initialization, and consistent filename casing. They retain the `ES2022` target and enable `isolatedModules` for Angular's per-file transpilation. The `module: preserve` setting implicitly enables `bundler` resolution and JSON-module support. The explicit `skipLibCheck: false` setting retains declaration-file checking, differing from the Angular CLI-generated configuration. Angular strict template checking uses its default enabled setting, and extended diagnostics use their default warning level. In Angular 22.2.1, the redundant `??` and `?.` checks still require an explicit `strict` or `strictNullChecks` setting and do not emit with only implicit TypeScript strictness. Keep nullable types and template guards aligned. Prefer `readonly` field initializers for observable pipelines whose dependencies are available during construction, with dependent fields declared after their dependencies. Standard ES2022 class-field semantics are enabled through the target default: field declarations create own properties, including `undefined` for fields without initializers. Use `inject()` fields declared before their consumers; constructor parameter properties are assigned after native field initialization. Reserve lifecycle initialization for work that needs initialized inputs or lifecycle state; fields that can remain absent should model that in their types. The `server.ts` import of locale settings from `angular.json` uses this implicit JSON-module support; these settings are included in the compiled server bundle. Angular builders control output paths and source maps. For direct TypeScript checks, use `npx tsc --noEmit -p tsconfig.app.json` or `npx tsc --noEmit -p tsconfig.spec.json`; the root configuration has no source files of its own. Root helper scripts remain CommonJS.
- **Hydration intentionally not enabled:** Client hydration is deliberately not configured because Ionic's underlying Stencil components do not currently support SSR hydration with Angular ([ionic-team/ionic-framework#30490](https://github.com/ionic-team/ionic-framework/issues/30490)). Hydration must be handled and tested as a dedicated SSR/deployment migration rather than folded into ordinary component work.

A two-stage Angular 22 modernization was completed in September–October 2026. The first stage was included in v3.1.0, and the second was implemented for v4.0.0. The [archived plans](migrations/completed/angular-22-modernization/README.md) retain the implementation and validation history.

When updating Angular, compare `src/server.ts`, bootstrap/provider configuration, and build/test options with the current CLI-generated structure and the [reference starter](https://github.com/SebastianKohler/ng22-ion9-ssr-starter). Reconcile API changes with the configured locales, generated render modes, request-context adapter, and Express middleware ordering described above. The custom server preserves these application contracts, so a generated replacement needs review and the SSR regression checks.



## nginx in production

[`compose.yml`](../compose.yml) runs nginx in front of the Node Express server. The containers share the `browser-static` volume: the app's `dist/app/browser/` output is available to nginx at `/static`. nginx serves browser bundles and other static files directly from this volume, keeping those requests out of Node and leaving the app server's resources available for SSR.

### Static routing and caching

[`nginx.conf`](../nginx.conf) gives different file types different cache policies:

- Hashed JavaScript, CSS, and fonts receive a one-year cache lifetime with `immutable`. Their filenames change when their content changes.
- Unversioned files under `/<locale>/assets/`, `/<locale>/static-html/`, and `/<locale>/svg/` receive a one-day cache lifetime.
- Root `/robots.txt` and `/sitemap.txt` are served from the default locale's browser directory with caching disabled.

The long-cache location covers `.js` and `.css` files directly under a locale prefix, plus fonts under `media/`. Its `(media/)?` part is optional: both `/sv/chunk-HASH.js` and `/sv/media/font-HASH.woff2` match. The application builder emits browser JavaScript as `.js`, including lazy-loaded chunks. The `.mjs` files belong to the Node server build under `dist/app/server/`, outside the shared browser volume.

The dedicated static locations return 404 for missing files. For other requests, `try_files $uri /$default_locale$uri @backend` tries the requested path and then the default locale's path before forwarding to Node. This lets unprefixed static URLs use the default locale while application pages reach the SSR handler.

### Precompressed static files

The `compress` script in [`package.json`](../package.json) processes browser output throughout `dist/app/browser/`, creating `.gz` siblings for its included HTML/text, CSS/JavaScript, SVG/icon, and TTF/OTF files of at least 1,300 bytes. It removes compressed copies larger than their originals. WOFF/WOFF2 are already compressed and excluded from the script. Docker runs it after building.

With `gzip_static on`, nginx can answer a request for `/sv/chunk-HASH.js` using `/sv/chunk-HASH.js.gz` when the client accepts gzip and the configured gzip conditions allow it. The URL retains its `.js` extension, so the existing static location and cache policy apply. The location regex does not need to include `.gz`. Dynamic SSR HTML is generated per request and uses on-the-fly compression when enabled. See [nginx's precompressed-file documentation](https://nginx.org/en/docs/http/ngx_http_gzip_static_module.html).

### SSR request handling

For requests that reach Node, [`src/server.ts`](../src/server.ts) combines the configured hop limit and proxy address list to resolve Express's `req.ip`. Static files and probes return before the limiter; the resolved IP is used to limit dynamic-render requests.

The Express middleware also checks the immediate peer before accepting `X-Forwarded-Host` and `X-Forwarded-Proto`. This is a narrow check of those two origin headers. Express handles the client-IP chain, and Angular filters unsupported forwarding headers, including `Forwarded` and `X-Forwarded-Prefix`. The peer check uses a trust function compiled at startup, with no per-request network lookup or scan of all headers. In the standard `HAProxy -> nginx -> Node` chain, nginx is the immediate peer; the check also protects alternate paths to Node.

nginx preserves the incoming `X-Forwarded-Proto` from an upstream TLS-terminating proxy, falling back to its own `$scheme` when the header is absent. The [origin helper](../src/app/utils/request-origin.ts) treats `app.siteURLOrigin` as authoritative when the request host matches the configured public host. This keeps canonical and Open Graph URLs on the public HTTPS origin even when an internal hop uses HTTP.

Fork settings belong in the project customization guide: [SSR proxy trust](PROJECT-CUSTOMIZATION.md#ssr-and-proxy-settings) and [nginx's default locale, HTML compression, and proxy buffers](PROJECT-CUSTOMIZATION.md#nginx-configuration). Image rollout, volume handling, and runtime environment overrides are covered in [deployment](DEPLOYMENT.md#deployment).



## Angular development server

`npm start` serves Swedish and `npm run start:fi` serves Finnish on port 4200. Both commands generate route metadata before starting Angular's development server, so they work without pre-existing ignored route outputs. To run both locales at once, choose another port for one server, for example `npm run start:fi -- --port 4202`.

The development server renders through SSR and then starts the browser application. Each server uses one locale with a `/` base href; production's locale-prefixed dispatch is verified separately with `npm run serve:ssr`. Development source maps include TypeScript and SCSS source content.

Angular applies hot updates to component templates/styles and global styles where supported, including `src/project/global-overrides.scss`. Project SCSS is compiled as a global stylesheet rather than copied as a public asset. TypeScript logic changes reload the page. A full reload clears unsaved component state, such as an index search term. See [Angular's HMR guidance](https://angular.dev/tools/cli/build-system-migration#hot-module-replacement).

The browser router uses the canonical `app.routes.ts` during development. Development SSR also consumes generated server-rendering metadata, so run `npm run generate-routes` after changing auth/feature-route configuration or route declarations while a server is running. When invoking `ng serve` directly instead of the npm start commands, generate routes first.


## Run Docker images locally on Windows

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

To run the app locally with the [production nginx setup](#nginx-in-production):

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

The Node.js Docker-image tag is defined by the default `NODE_IMAGE_TAG` build argument in [`Dockerfile`](../Dockerfile). Local builds and the supplied GitHub Actions workflow use this default. For an individual build, it can still be overridden with `--build-arg NODE_IMAGE_TAG=<tag>`.

The supplied GitHub Actions build workflow is defined in [`.github/workflows/docker-build-and-push.yml`](../.github/workflows/docker-build-and-push.yml). It sets up a Docker Buildx builder using `docker/setup-buildx-action` and then runs the build with `docker/build-push-action` (BuildKit). The workflow uses `pull: true` so the builder refreshes base images using the tag defined in `Dockerfile`.

Run `npm run test:docker-workflow` after changing source selection, image metadata, or latest-release publishing. The check executes the workflow's inline scripts with GitHub and Docker fixtures, covering manual source-tag overrides, invalid tags, the reserved `latest` alias, release designation, and API failures. It requires neither Docker nor network access. Fork operation and the manual rebuild form are documented in [deployment](DEPLOYMENT.md#rebuild-an-existing-release-image).

When updating the supported Node.js version, keep all version declarations and developer-facing guidance aligned:

- update the default `NODE_IMAGE_TAG` in [`Dockerfile`](../Dockerfile),
- update both `engines.node` and `devEngines.runtime.version` in [`package.json`](../package.json),
- update the Node.js prerequisite in [`README.md`](../README.md),
- regenerate or update `package-lock.json` as needed so its metadata remains consistent.



## Testing

Use the Angular/Vitest unit suite as the primary automated check, with the script-based checks for the areas they specifically cover:

- `npm test`: run Angular/Vitest unit tests in watch mode in an interactive terminal while developing.
- `npm run test:ci`: run the full Angular/Vitest unit suite once with jsdom; use this for pre-PR verification.
- `npm run test:source-encoding`: validate source-file encoding and BOM usage.
- `npm run test:routes-parser`: verify route parser/generator behavior; run it after changes to `prebuild-generate-routes.js` or generator-facing route syntax in `src/app/app.routes.ts`.
- `npm run test:static-collection-menus`: verify that shared non-multilingual TOCs are fetched once, per-locale menu files are generated, and fetch retries back off as expected; run it after changes to `prebuild-generate-static-collection-menus.js` or shared fetch retry behavior in `prebuild-common-fns.js`.
- `npm run test:ssr:smoke`: verify selected SSR/CSR responses, SEO/default-language URLs, and missing-static-file behavior against a running SSR app; build and start the app first, or pass `--base-url` to target another running environment.
- `npm run test:ssr:server`: build SSR, import the middleware from the emitted server entry, and exercise it with a spy in place of Angular. Verify static/probe short-circuits, cache policies, dynamic limiting, locale paths, and trusted-proxy behavior without rendering Angular. The imported entry starts no listener; fixture apps use temporary local HTTP servers.
- `npm run test:ssr:checks`: verify that the smoke runner rejects incorrect render modes and redirects, and sends explicit proxy Host headers, using local fixtures without a running app.
- `npm run test:ssr:benchmark`: verify benchmark request pacing and argument validation, response timings, and auto-start through `serve:ssr`, including an alternate runtime entry, failed startup, interruption, and child-process cleanup, using local fixtures without building the app.
- `npm run test:ssr:docker`: build/run the local production Docker image and record memory across repeated SSR load/idle cycles; see the [Docker memory check](#repeatable-docker-ssr-memory-check). `npm run test:ssr:docker:checks` verifies argument/URL/sample handling and response validation with local fixtures, without Docker or a build.
- `npm run test:build-output`: verify browser output for the production locales configured in `angular.json` and the runtime entry from `serve:ssr`; run after `npm run build:ssr`. Supports `--dist-root`, `--locales` (comma-separated), and `--server-entry` (relative to the output root) for custom output.

The [unit-test target](../angular.json) lets Angular initialize TestBed and inherits application styles, assets, and polyfills, including `@angular/localize/init` and the Ionicons polyfill. Locale-specific XLF translations are not inlined into unit tests. [`tsconfig.spec.json`](../tsconfig.spec.json) supplies `vitest/globals`; [`src/test-setup.ts`](../src/test-setup.ts) restores spies and real timers after each test. Prefer Angular CLI test options; the suite does not need a custom Vitest configuration or browser provider. See the [Vitest notes](#vitest-and-jsdom) for localization, mock, and timer patterns. The supplied GitHub Actions workflow builds/pushes the Docker image; it does not run the unit suite, so run `test:ci` before a PR or add a dedicated unit-test CI job.

When changing `app.routes.ts` or a lazy `*.routes.ts` file, also update and run the Angular route-recognition specs. For SSR-specific changes, run `npm run build:ssr`, start the built app with `npm run serve:ssr`, and then run `npm run test:ssr:smoke` in another terminal. The detailed route-parser and SSR smoke-test sections below describe those workflows further.



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
- `--auth-enabled` to expect CSR shells for protected routes in an already built auth-enabled app. It changes test expectations only; the built app and running process must match that test configuration. Without the flag, protected routes must SSR and auth-only routes must return 404. Rebuild and restart between auth configurations when verifying both modes.
- `--cases-file=<path>` to load a JSON array of test cases for custom routes/locales. The default fixtures use the base app's Swedish/Finnish content. JSON cases use the same fields as `TEST_CASES`, but `checks` and optional `csrChecks` accept only `includes` checks with literal string values (for example, `{ "type": "includes", "value": "lang=\"fi\"" }`). Regex checks require code-owned `RegExp` literals in the script; JSON pattern strings are rejected before requests run. Optional `csrChecks` validate locale/base href in CSR mode.

Example:

```bash
npm run test:ssr:smoke -- --base-url=http://localhost:4201 --timeout-ms=5000
```

What the smoke test validates per route:

- HTTP status matches the expected result (`200`, `301` for legacy ebook redirects, or `404` for missing files/pages and disabled auth-only routes); redirects are not followed. Redirect cases also require an exact `Location` header through `expectedLocation`.
- `Content-Type` contains `text/html`.
- SSR responses contain a populated Angular root and the expected content/SEO snippets. CSR responses contain an empty root without server-rendered protected content; public pages remain SSR with auth enabled.
- Dynamic responses include `Vary: User-Agent`. Missing static files contain no Angular application or SSR rate-limit headers.
- Unprefixed home requests use the configured default language (Swedish in the base app), regardless of the `Accept-Language` header.
- Optional per-test request headers can be set in `TEST_CASES` (for example to simulate forwarded HTTPS headers).

Updating checks:

- Edit `TEST_CASES` in [`scripts/test-ssr-smoke.js`](../scripts/test-ssr-smoke.js) when expected content changes.
- Prefer deterministic snippets that are stable across builds.
- Use regex checks only when HTML attribute order can vary.



## SSR benchmark

Use the SSR benchmark to measure response-time performance of server-rendered routes (cold and warm runs).

- Test script: [`scripts/benchmark-ssr.js`](../scripts/benchmark-ssr.js)
- npm commands: `npm run bench:ssr`, `npm run bench:ssr:build`
- Default base URL: `http://127.0.0.1:4201`

Auto-start uses `npm run serve:ssr`, the same launcher used by the Docker runtime. The benchmark stops its launcher and SSR child processes when it finishes, is interrupted, or cannot start the server.

The first request per route is labeled cold, but readiness has already rendered the first route before measurement. It is not a process-start measurement. Requests can include live API and rendering costs; check response status, size, and completeness before interpreting latency changes. Keep critical CSS inlining disabled for comparable measurements.

Requests run sequentially with a two-second pause after each response before the next request starts. The pause also applies between routes, after failed requests, and between successful readiness and the first measured request; failed readiness probes wait at least this long before retrying within the startup timeout. Pauses are excluded from response timings, and there is no pause before the first request to an existing server or after the final request.

Use `--request-delay-ms=<number>` to adjust pacing for the backend's capacity and request limits. Increase it when content retrieval fails or the backend is rate limited; an HTTP 200 page can still contain a content-loading error. Use the same delay, routes, and request counts when comparing app versions. Set the delay to `0` only when deliberately benchmarking a dedicated local server without pacing.

When auto-starting with a long pause, increase `--startup-timeout-ms` as needed so the startup budget leaves time for readiness retries with that pause.

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
- `--request-delay-ms=<integer>` to set the pause between requests in milliseconds (default: `2000`; `0` disables pacing).
- `--skip-start` to benchmark an existing server without invoking `npm run serve:ssr`.

Example:

```bash
npm run bench:ssr -- --warm-runs=8 --routes=/sv/,/sv/collection/216/text/20280
```

For a live site, for example with a five-second pause:

```bash
npm run bench:ssr -- --skip-start --base-url=https://topelius.sls.fi --request-delay-ms=5000
```

What the benchmark reports:

- Per-request timing table with status, elapsed milliseconds, and response size.
- Configured request delay, excluded from the reported response times.
- Cold run summary (run 1 per route).
- Warm run summary with `avg`, `median`, `p95`, `min`, and `max`.



## Repeatable Docker SSR memory check

With Docker Desktop running in Linux-container mode, run the [memory test runner](../scripts/docker-ssr-memory.js):

```bash
npm run test:ssr:docker -- --pull
```

It builds the local image, warms public SSR routes, then repeats requests and idle periods while printing progress and memory usage. Allow **10–15 minutes for requests and idle periods**, including a two-minute final idle observation. This phase has a 15-minute limit; building, startup, and cleanup take additional time.

Useful options:

- `--skip-build`: reuse the local image.
- `--keep-container`: leave the container running for Docker Desktop inspection.
- `--routes-file=<path>`: replace the sample-edition routes with a public SSR URL list; all URLs are remapped to the local container.
- `--final-idle-seconds=<n>`: change the final idle observation.
- `--help`: show all options and defaults.

Results are saved under `tmp/docker-ssr-memory/<timestamp>/` as `samples.csv`, `report.json`, and `container.log`. Press Ctrl+C to stop early and save partial results. The container is removed unless `--keep-container` is set; images and reports remain.

Review idle values across cycles and recovery during the final pause. A stable warm plateau can remain above startup usage. Use `--max-growth-mib=<MiB>` to enforce an optional growth budget. See the script headers and `--help` for measurement and validation details.

### Compare with a known-good release image

Pull the release image and select it with `--skip-build --image`:

```bash
docker pull ghcr.io/slsfi/digital-edition-frontend-ng:3.1.1
npm run test:ssr:docker -- --skip-build --image=ghcr.io/slsfi/digital-edition-frontend-ng:3.1.1
```

Run images sequentially with the same routes and settings, then compare the reports' idle trends, peaks, and final recovery. Absolute memory usage can differ between versions.


## Feature-based route generation

The generator derives production routes and Angular rendering modes from the canonical route source and configuration. Fork-facing feature selection and generation commands are documented in [project customization](PROJECT-CUSTOMIZATION.md#feature-based-route-generation); the notes below describe implementation and extension points.

- Canonical top-level routes source (edited by developers): [`src/app/app.routes.ts`](../src/app/app.routes.ts)
- Generated file: [`src/app/app.routes.generated.ts`](../src/app/app.routes.generated.ts)
- Generated Angular server-rendering modes: [`src/app/app.routes.server.generated.ts`](../src/app/app.routes.server.generated.ts)
- Generator script: [`prebuild-generate-routes.js`](../prebuild-generate-routes.js)
- npm command: `npm run generate-routes`

Simple routes use `loadComponent` directly in `app.routes.ts`. Routes with multiple URL shapes, child paths, or observable parent-route behavior use a top-level `loadChildren` entry that loads a standalone `Routes` array from the corresponding `*.routes.ts` file under `src/app/pages/`.

The generator parses and filters only the top-level route blocks in `app.routes.ts`. It copies their references to lazy route arrays unchanged; it does not parse, duplicate, or independently feature-filter the child routes in those files. A child route is available in production whenever its top-level parent route is included.

Both generated artifacts use that same filtered route set. With auth disabled, the server-route file contains only a final `**` route with `RenderMode.Server`. With auth enabled, included paths protected by `authGuard` or `authFeatureEnabledMatchGuard` receive `RenderMode.Client` entries before that fallback. Protected parents with `loadChildren` or inline `children` also receive a `parent/**` entry so their descendants remain client rendered; route parameters stay parameterized and locale prefixes are not added. A protected catch-all is rejected because it conflicts with the required server-rendered fallback. The generator emits no prerender routes, and repeated generation produces identical content.

The server configuration consumes `app.routes.server.generated.ts` through `provideServerRendering(withRoutes(serverRoutes))`. Angular owns auth-protected CSR shells. Sitemap generation uses the shared protected-route parser directly against the canonical route source. Both generated route artifacts are ignored by Git; edit the canonical source and regenerate them with `npm run generate-routes`.

Feature inclusion is centralized in `getRouteIncludeByPath()` in [`prebuild-common-fns.js`](../prebuild-common-fns.js). The route generator applies this path-based map when feature filtering is active; new top-level paths without a mapping remain included by default and produce a warning. When adding a configurable feature, update that map and the corresponding parser tests. Lazy child routes are covered by their parent rather than separate filtering rules.

Build behavior:

- development builds/serve use `src/app/app.routes.ts` directly (all routes enabled)
- `npm start` and `npm run start:fi` generate the server-rendering route metadata before starting development SSR
- production builds replace `src/app/app.routes.ts` with `src/app/app.routes.generated.ts` using Angular `fileReplacements`
- `build:ssr` runs `generate-routes` explicitly before the production build

If you run Angular CLI build or serve commands directly, run `npm run generate-routes` first.

Parser smoke tests:

- Test script: [`scripts/test-prebuild-generate-routes.js`](../scripts/test-prebuild-generate-routes.js)
- npm command: `npm run test:routes-parser`
- run these tests after changes to `prebuild-generate-routes.js` and after generator-facing route syntax changes in `src/app/app.routes.ts`
- run the Angular route-recognition tests after changes to either `app.routes.ts` or a lazy `*.routes.ts` file
- the parser checks cover auth/feature-filter combinations, parameterized and lazy server paths, deterministic output, and generated `ServerRoute[]` compatibility with the installed Angular SSR types



## Router preloading strategy

The app uses a platform-specific router preloading strategy:

- **Browser**: lazy routes are preloaded by default on good networks (when idle), unless route data overrides this behavior.
- **Server (SSR)**: no route preloading (`NoPreloading`).

Implementation files:

- [`src/app/services/router-preloading-strategy.service.ts`](../src/app/services/router-preloading-strategy.service.ts)
- [`src/app/app.config.ts`](../src/app/app.config.ts)
- [`src/app/app.config.server.ts`](../src/app/app.config.server.ts)
- [`src/app/app.routes.ts`](../src/app/app.routes.ts)
- [`src/app/app.routes.generated.ts`](../src/app/app.routes.generated.ts)
- Lazy standalone route arrays under `src/app/pages/`, currently:
  - [`about.routes.ts`](../src/app/pages/about/about.routes.ts)
  - [`article.routes.ts`](../src/app/pages/article/article.routes.ts)
  - [`collection-text.routes.ts`](../src/app/pages/collection/text/collection-text.routes.ts)
  - [`ebook.routes.ts`](../src/app/pages/ebook/ebook.routes.ts)
  - [`media-collection.routes.ts`](../src/app/pages/media-collection/media-collection.routes.ts)

The preloading strategy applies to both `loadComponent` and `loadChildren`. Route-level behavior is set with `data.preload` on the route declaration that owns the lazy load. Developers set it in `app.routes.ts` or one of the lazy `*.routes.ts` files. Do not edit `app.routes.generated.ts`; route generation copies the top-level metadata from `app.routes.ts`:

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

- All current lazy routes use the default `idle-if-fast` behavior.
- A route can override the default with `eager`, `idle`, or `off`.
- For a `loadChildren` route, the parent route array must first be loaded before the router can discover and apply preloading rules to its child routes. Setting the parent to `off` therefore also prevents its not-yet-loaded children from being considered for preloading.



## Authentication integration

Authentication is integrated through the shared providers, route guards, HTTP interceptor, and generated server-rendering modes. Keep the disabled configuration working when changing these components: the auth interceptor is not registered, protected routes retain public SSR, and auth-only routes remain unavailable.

The server-route generator recognizes `authGuard` and `authFeatureEnabledMatchGuard`. With auth enabled, it emits `RenderMode.Client` entries for protected routes and their lazy descendants. Tokens are stored in browser storage rather than cookies, so the initial SSR request cannot identify an authenticated browser session. Public routes remain server rendered; Angular owns the protected CSR shells.

When modifying authentication, verify both enabled and disabled configurations, including startup validation, token refresh, redirects, route recognition, and generated rendering modes. The [authentication guide](AUTHENTICATION.md) maintains the behavior contract and manual regression checklist, as well as the fork configuration instructions reached through [project customization](PROJECT-CUSTOMIZATION.md#authentication).



## Registering icons

Application icons referenced by name are registered centrally in [`src/ionicons-polyfill.ts`](../src/ionicons-polyfill.ts). The browser build loads this file as a polyfill before `main.ts`, and Angular's unit-test builder inherits the same polyfill for Vitest.

The early browser registration is required for SSR. When the client starts, the `ion-icon` custom element upgrades the icon elements already present in the server-rendered HTML before Angular creates the page components. Registering icons only in component constructors is therefore too late and produces Ionicons `Invalid base URL` warnings during client bootstrap.

When adding an icon:

1. Import its SVG data by name from `ionicons/icons` in [`src/ionicons-polyfill.ts`](../src/ionicons-polyfill.ts).
2. Add it to the object passed to `addIcons()` in the same file.
3. Import the standalone `IonIcon` component in the Angular component that uses it, then reference the registered icon with its kebab-case name, for example `<ion-icon name="information-circle-sharp"></ion-icon>`.
4. For a dynamic `[name]` binding, register every icon name the binding can produce.

Do not add component-local `addIcons()` calls. The central registry is the single source of truth for application-owned icons.



## Publication metadata

The supported field contract for the collection text metadata panel is documented in [`docs/PUBLICATION-METADATA.md`](PUBLICATION-METADATA.md).

Update that document when changing `PublicationMetadata`, nested manuscript, variant, or facsimile metadata, or the metadata component template.



## Dependencies

The app is built on Angular and uses many web components from Ionic. It also has a few other essential dependencies, which are briefly described below.


### `@angular`

The Angular documentation is available on <https://angular.dev/>.

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


### [`dom-serializer`][npm_dom-serializer]

Serializes the DOM produced by `htmlparser2` back to HTML after the app updates image paths and class names.


### [`domhandler`][npm_domhandler]

Builds a DOM tree from `htmlparser2` parser events. Provides the `DomHandler` class and node type guards such as `isTag`. Import the type guards directly from `domhandler`; their deprecated re-exports were removed from `domutils` in version 4.


### [`domutils`][npm_domutils]

Utilities for querying and traversing the DOM produced by `domhandler`, used to find headings and illustrations and inspect their attributes.


### [`express`][npm_express]

Framework for running a web server in Node.js. This library is required by Angular to enable server-side rendering.

### [`express-rate-limit`][npm_express-rate-limit]

Middleware used for app-level request limiting of dynamic SSR/CSR shell responses in the Node server.


### [`htmlparser2`][npm_htmlparser2]

SSR-compatible HTML/XML parser, used in a few places in the app to parse HTML from the backend.

[`HtmlParserService`](../src/app/services/html-parser.service.ts) uses `domhandler`, `domutils`, and `dom-serializer` alongside `htmlparser2`. All four packages are declared as direct runtime dependencies in `package.json` because application code imports them. Keep their versions compatible with `htmlparser2` when updating so that application imports do not depend on which versions npm installs transitively through Angular's build tooling.


### [`ionicons`][npm_ionicons]

Iconset especially intended to be used with Ionic. See the [instruction on how to register icons below](#registering-icons).


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


### [`gzipper`][npm_gzipper] (devDependency)

Library for compressing files. Used in `Dockerfile` in a post-build step to create compressed (gzip) versions of static files. It’s configured in the `compress` script in `package.json`.


### [`ng-extract-i18n-merge`][npm_ng-extract-i18n-merge] (devDependency)

Library for extracting and merging i18n xliff translation files for Angular projects. This library extends the default Angular CLI, and is used to sort the keys in the xliff translation files. Used when running the `extract-i18n` script in `package.json` to create the xliff translation files for the app.

The wrapper delegates extraction to `@angular/build:extract-i18n` using the application's build target. `npm run extract-i18n` retains XLIFF 2 output in `src/locale`, sorts units by ID, and merges the Finnish, Swedish, and English target files. The technical source locale remains `aa`; extraction does not change which locales are emitted by application builds. Application builds, development serving, unit tests, and extraction all use `@angular/build`.


### [`vitest`][npm_vitest] and [`jsdom`][npm_jsdom] (devDependencies)

Angular unit tests run through `@angular/build:unit-test` with Vitest and jsdom. Use `npm test` for watch mode in an interactive terminal or `npm run test:ci` for a single run. A Chrome installation is no longer required for the unit suite.

The builder initializes TestBed and inherits the application's development styles, assets, and polyfills, including `@angular/localize/init` and the centralized Ionicons polyfill. [`src/test-setup.ts`](../src/test-setup.ts) restores method/property spies and real timers after each test. Use `vi.fn()` and `vi.spyOn()` for mocks; type partial service fakes with `MockedObject<Pick<Service, 'method'>>`, preserving real signal properties separately. Use native async tests and Vitest fake timers, advancing scheduled rendering before `fixture.whenStable()` when timers are mocked.

The Vitest builder overrides the build's `localize` option with `false`, so unit tests do not inline translations from `src/locale/*.xlf`. Without runtime translations, `$localize` returns the source text. For translation tests, use `loadTranslations()` from `@angular/localize` before creating the component, with a dictionary covering every message evaluated by the fixture, including template `i18n` labels. Individual tests can then override selected entries. Once runtime translation lookup is active, omitted messages produce `No translation found` warnings and fall back to their source text. Clear the global dictionary with `clearTranslations()` before and after each test to prevent translations leaking between tests. Setting `LOCALE_ID` does not load a translation dictionary, and the build's `i18nMissingTranslation` option does not suppress runtime warnings. See the [main side menu specs](../src/app/components/menus/main-side/main-side-menu.component.spec.ts) and [content page specs](../src/app/pages/content/content.page.spec.ts) for examples.


### Updating transitive dependencies

Keep `package-lock.json` when updating transitive dependencies so that the changes remain reproducible and reviewable. Update all dependencies to the newest versions permitted by their existing semver ranges with:

```bash
npm update
```

Some dependencies run lifecycle scripts during installation. The approved package versions are pinned in the `allowScripts` section of `package.json`. After updating, list packages whose scripts are not covered by an existing approval:

```bash
npm approve-scripts --allow-scripts-pending
```

Review each reported package and its changes before approving it. Approve packages individually, or list several package names in the same command:

```bash
npm approve-scripts <package> [<package> ...]
```

This updates the package's version-pinned entry in `allowScripts`. Do not replace it with an unversioned approval unless future versions of that package should be allowed to run install scripts without another review.

Finally, perform a clean installation from the updated lockfile and run the standard verification checks:

```bash
npm ci
npm run test:ci
npm run test:source-encoding
npm run test:routes-parser
npm run test:static-collection-menus
npm run build:ssr
```

Then start the built SSR app:

```bash
npm run serve:ssr
```

While it is running, use another terminal to run the SSR smoke test:

```bash
npm run test:ssr:smoke
```

`npm ci` removes the existing `node_modules` directory automatically. Commit the reviewed `package-lock.json` changes and, when approvals changed, the corresponding `package.json` changes. Deleting and regenerating the lockfile should only be necessary when repairing a broken dependency tree.



## TODOs

Cross-cutting future work that should stay visible outside local code comments is tracked in [`docs/TODO.md`](TODO.md).



[angular_update_guide]: https://angular.dev/update-guide
[docker_compose_file]: ../compose.yml
[docker_desktop]: https://www.docker.com/products/docker-desktop/
[dockerfile]: ../Dockerfile
[npm_dom-serializer]: https://www.npmjs.com/package/dom-serializer
[npm_domhandler]: https://www.npmjs.com/package/domhandler
[npm_domutils]: https://www.npmjs.com/package/domutils
[npm_express]: https://www.npmjs.com/package/express
[npm_express-rate-limit]: https://www.npmjs.com/package/express-rate-limit
[npm_htmlparser2]: https://www.npmjs.com/package/htmlparser2
[npm_ionicons]: https://www.npmjs.com/package/ionicons
[npm_jsdom]: https://www.npmjs.com/package/jsdom
[npm_marked]: https://www.npmjs.com/package/marked
[npm_marked-custom-heading-id]: https://www.npmjs.com/package/marked-custom-heading-id
[npm_marked-footnote]: https://www.npmjs.com/package/marked-footnote
[npm_rxjs]: https://www.npmjs.com/package/rxjs
[npm_tslib]: https://www.npmjs.com/package/tslib
[npm_gzipper]: https://www.npmjs.com/package/gzipper
[npm_ng-extract-i18n-merge]: https://www.npmjs.com/package/ng-extract-i18n-merge
[npm_vitest]: https://www.npmjs.com/package/vitest
