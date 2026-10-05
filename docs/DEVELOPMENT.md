# Development

This document contains notes and tips on the development of the app.


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

In production, nginx is run in a Docker container in front of the app container so nginx, which is more performant than Node.js, can serve static files. To run the app in this setup locally:

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

When updating the supported Node.js version, keep all version declarations and developer-facing guidance aligned:

- update `NODE_IMAGE_TAG` in [`.github/workflows/docker-build-and-push.yml`](../.github/workflows/docker-build-and-push.yml),
- update the default `NODE_IMAGE_TAG` in [`Dockerfile`](../Dockerfile),
- update both `engines.node` and `devEngines.runtime.version` in [`package.json`](../package.json),
- update the Node.js prerequisite in [`README.md`](../README.md),
- regenerate or update `package-lock.json` as needed so its metadata remains consistent.



## Application architecture

The app is a standalone, zoneless Angular application with server-side rendering and Ionic UI components.

- **Standalone Angular application:** [`src/main.ts`](../src/main.ts) and [`src/main.server.ts`](../src/main.server.ts) both bootstrap `AppComponent` with `bootstrapApplication()`. There are no application, server, page, or routing NgModules owned by this repository; page templates and reusable components import their Angular and Ionic dependencies directly.
- **Browser/server bootstrap and shared provider configuration:** The browser bootstrap uses [`src/app/app.config.ts`](../src/app/app.config.ts), while the server bootstrap uses [`src/app/app.config.server.ts`](../src/app/app.config.server.ts). The browser configuration owns shared router, HTTP, Ionic, and application providers and selects browser implementations of platform-specific services. The server configuration uses `mergeApplicationConfig()` so server-only providers are applied after the shared browser configuration and override the platform-specific browser implementations.
- **Ionic standalone components and the `IonicServerModule` bridge:** Application components import the standalone Ionic components they use rather than `IonicModule`, and application-level Ionic providers are registered with `provideIonicAngular()`. On the server, `importProvidersFrom(IonicServerModule)` is the sole intentional application-level NgModule bridge because Ionic does not expose an equivalent standalone server-provider function.
- **Zoneless change detection:** The application uses Angular's zoneless change detection and does not register `provideZoneChangeDetection()` or another change-detection compatibility provider. Components expose asynchronous template state through signals, inputs, the `async` pipe, or other Angular notification mechanisms. Zone.js is absent from browser, server, and test polyfills and from the dependency tree.
- **SSR via `CommonEngine`:** [`server.ts`](../server.ts) passes the server bootstrap function to `CommonEngine`, which remains the app's SSR integration.
- **Retained Webpack `browser`/`server` builders and `dist/app` contract:** The application intentionally retains Angular's separate Webpack-based `browser` and `server` builders in `angular.json` and the existing `dist/app` output contract. Migration to the [`application` builder](https://angular.dev/tools/cli/build-system-migration) is deferred as a separate breaking change.
- **Hydration intentionally not enabled:** Client hydration is deliberately not configured because Ionic's underlying Stencil components do not currently support SSR hydration with Angular ([ionic-team/ionic-framework#30490](https://github.com/ionic-team/ionic-framework/issues/30490)). The application therefore retains the non-hydrated `CommonEngine` SSR lifecycle; enabling hydration must be handled and tested as a dedicated SSR/deployment migration rather than folded into ordinary component work.

The current architecture resulted from the completed standalone and zoneless phase of a [two-stage Angular modernization](migrations/README.md). The migration overview also links to the planned application-builder and Vitest phase.



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

#### Updating Ionic

Run

```bash
npm install @ionic/angular @ionic/angular-server
```


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


### [`browser-sync`][npm_browser-sync] (devDependency)

Required by the Angular builders.


### [`gzipper`][npm_gzipper] (devDependency)

Library for compressing files. Used in `Dockerfile` in a post-build step to create compressed (gzip) versions of static files. It’s configured in the `compress` script in `package.json`.


### [`ng-extract-i18n-merge`][npm_ng-extract-i18n-merge] (devDependency)

Library for extracting and merging i18n xliff translation files for Angular projects. This library extends the default Angular CLI, and is used to sort the keys in the xliff translation files. Used when running the `extract-i18n` script in `package.json` to create the xliff translation files for the app.


### `jasmine` and `karma`

Unit-testing framework and test runner. Use `npm test` for watch mode or
`npm run test:ci` for a single run. Karma uses a headless Chrome launcher with
GPU acceleration disabled by default because the regular Chrome launcher is
not reliable in the supported development environment.


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



## Testing

Use the Angular/Jasmine unit suite as the primary automated check, with the script-based checks for the areas they specifically cover:

- `npm test`: run Angular/Jasmine unit tests in Karma watch mode while developing.
- `npm run test:ci`: run the full Angular/Jasmine unit suite once in headless Chrome; use this for pre-PR verification.
- `npm run test:source-encoding`: validate source-file encoding and BOM usage.
- `npm run test:routes-parser`: verify route parser/generator behavior; run it after changes to `prebuild-generate-routes.js` or generator-facing route syntax in `src/app/app.routes.ts`.
- `npm run test:static-collection-menus`: verify that shared non-multilingual TOCs are fetched once, per-locale menu files are generated, and fetch retries back off as expected; run it after changes to `prebuild-generate-static-collection-menus.js` or shared fetch retry behavior in `prebuild-common-fns.js`.
- `npm run test:ssr:smoke`: verify selected server-rendered responses against a running SSR app; build and start the app first, or pass `--base-url` to target another running environment.

When changing `app.routes.ts` or a lazy `*.routes.ts` file, also update and run the Angular route-recognition specs. For SSR-specific changes, run `npm run build:ssr`, start the built app with `npm run serve:ssr`, and then run `npm run test:ssr:smoke` in another terminal. The detailed route-parser and SSR smoke-test sections below describe those workflows further.



## Registering icons

Application icons referenced by name are registered centrally in [`src/ionicons-polyfill.ts`](../src/ionicons-polyfill.ts). The browser build loads this file as a polyfill before `main.ts`, and the Karma bootstrap imports the same registry from [`src/test.ts`](../src/test.ts).

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



## Feature-based route generation

The app can generate its top-level production routes at build time based on values in [`src/assets/config/config.ts`](../src/assets/config/config.ts).

- Canonical top-level routes source (edited by developers): [`src/app/app.routes.ts`](../src/app/app.routes.ts)
- Generated file: [`src/app/app.routes.generated.ts`](../src/app/app.routes.generated.ts)
- Generated auth-guarded route paths: [`src/app/auth-protected-route-paths.generated.ts`](../src/app/auth-protected-route-paths.generated.ts)
- Generator script: [`prebuild-generate-routes.js`](../prebuild-generate-routes.js)
- npm command: `npm run generate-routes`

Simple routes use `loadComponent` directly in `app.routes.ts`. Routes with multiple URL shapes, child paths, or observable parent-route behavior use a top-level `loadChildren` entry that loads a standalone `Routes` array from the corresponding `*.routes.ts` file under `src/app/pages/`.

The generator parses and filters only the top-level route blocks in `app.routes.ts`. It copies their references to lazy route arrays unchanged; it does not parse, duplicate, or independently feature-filter the child routes in those files. A child route is available in production whenever its top-level parent route is included.

Feature toggle in config:

- `app.prebuild.featureBasedRoutes` (default: `false`)
- when `false`, the generated routes include all default lazy routes
- when `true`, the generated routes include only feature-enabled top-level routes
- filtering is path-based in `prebuild-generate-routes.js`; any new top-level route not listed in the filter map remains included by default

Build behavior:

- development builds/serve use `src/app/app.routes.ts` directly (all routes enabled)
- production builds replace `src/app/app.routes.ts` with `src/app/app.routes.generated.ts` using Angular `fileReplacements`
- `build:ssr` runs `generate-routes` explicitly before the production build

If you run production Angular CLI commands directly, run `npm run generate-routes` first.

Parser smoke tests:

- Test script: [`scripts/test-prebuild-generate-routes.js`](../scripts/test-prebuild-generate-routes.js)
- npm command: `npm run test:routes-parser`
- run these tests after changes to `prebuild-generate-routes.js` and after generator-facing route syntax changes in `src/app/app.routes.ts`
- run the Angular route-recognition tests after changes to either `app.routes.ts` or a lazy `*.routes.ts` file



## Authentication-guarded routing and token-based authentication flow

Authentication support is optional and config-driven, allowing forks to protect selected routes while the base app remains auth-disabled by default.

- Enable it with `app.auth.enabled` in [`src/assets/config/config.ts`](../src/assets/config/config.ts).
- Protect route declarations with `authGuard`; auth-related production route metadata is generated by `npm run generate-routes`.
- Because tokens are stored in browser storage rather than cookies, auth-protected routes receive a client-rendered shell instead of SSR when authentication is enabled.
- Session startup validation, token refresh, redirects, sitemap behavior, static collection menus, and the manual regression checklist are documented in the [authentication guide](AUTHENTICATION.md).


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




## TODOs

Cross-cutting future work that should stay visible outside local code comments is tracked in [`docs/TODO.md`](TODO.md).


[angular_update_guide]: https://update.angular.io/
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
[npm_marked]: https://www.npmjs.com/package/marked
[npm_marked-custom-heading-id]: https://www.npmjs.com/package/marked-custom-heading-id
[npm_marked-footnote]: https://www.npmjs.com/package/marked-footnote
[npm_rxjs]: https://www.npmjs.com/package/rxjs
[npm_tslib]: https://www.npmjs.com/package/tslib
[npm_browser-sync]: https://www.npmjs.com/package/browser-sync
[npm_gzipper]: https://www.npmjs.com/package/gzipper
[npm_ng-extract-i18n-merge]: https://www.npmjs.com/package/ng-extract-i18n-merge
