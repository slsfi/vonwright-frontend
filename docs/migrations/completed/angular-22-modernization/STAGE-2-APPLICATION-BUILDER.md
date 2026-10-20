# Angular 22 modernization — Stage 2: application builder and Vitest migration

> [!IMPORTANT]
> **Status: Completed; phases 1–20 complete, planned for release 4.0.0.** The application-builder/SSR cutover, development/deployment checkpoints, complete route/auth/test/browser matrix, performance comparison, and documentation are verified. Vitest with jsdom passes all 267 tests across 44 files, legacy build/test tooling is removed, and the public asset/fork customization layout is implemented. This plan retains the migration and validation history. Fork maintainers should use the [v4 breaking changes and fork migration notes](../../../breaking-changes/v4.md); current operating guidance lives in [development](../../../DEVELOPMENT.md) and [deployment](../../../DEPLOYMENT.md).

This is the second stage of the repository's [two-stage Angular modernization](README.md). It migrates the application from Angular's deprecated Webpack-based `browser`/`server` build pipeline to the integrated `application` builder and migrates unit testing from Jasmine/Karma to Vitest.

Stage 1 established the standalone, zoneless application architecture while deliberately retaining the old builders, `CommonEngine`, the existing output layout, Jasmine/Karma, and non-hydrated SSR. Stage 2 changes the build system, server runtime, and unit-test runner while preserving application behavior as far as practical.

The plan is structured so that preparatory changes can be committed and tested independently. Two transitions are intentionally atomic because the repository must stay runnable at every commit:

1. the `application`-builder/SSR cutover, where `angular.json`, server bootstrapping, server rendering configuration, TypeScript configuration, and npm build scripts must agree;
2. the final Jasmine/Karma -> Vitest runner cutover, where all test files must compile and run under one test API.

Review Angular's current migration guidance again immediately before implementation because the migration schematic, SSR APIs, and test-migration schematic can evolve:

- https://angular.dev/tools/cli/build-system-migration
- https://angular.dev/best-practices/performance/ssr
- https://angular.dev/api/ssr/node/AngularNodeAppEngine
- https://angular.dev/guide/testing/migrating-to-vitest
- https://angular.dev/guide/testing
- https://angular.dev/guide/i18n/deploy

---

## Reference implementation

Use [SebastianKohler/ng22-ion9-ssr-starter](https://github.com/SebastianKohler/ng22-ion9-ssr-starter) as the primary reference implementation for Stage 2.

This plan was revised against commit [`d012cb4a9c8942ded25b95de37b6ceede87edfa9`](https://github.com/SebastianKohler/ng22-ion9-ssr-starter/tree/d012cb4a9c8942ded25b95de37b6ceede87edfa9). Recheck the starter's current `main` branch immediately before implementation, but keep the recorded commit available as a stable comparison point.

The most relevant reference files are:

- [`angular.json`](https://github.com/SebastianKohler/ng22-ion9-ssr-starter/blob/d012cb4a9c8942ded25b95de37b6ceede87edfa9/angular.json)
- [`package.json`](https://github.com/SebastianKohler/ng22-ion9-ssr-starter/blob/d012cb4a9c8942ded25b95de37b6ceede87edfa9/package.json)
- [`src/server.ts`](https://github.com/SebastianKohler/ng22-ion9-ssr-starter/blob/d012cb4a9c8942ded25b95de37b6ceede87edfa9/src/server.ts)
- [`src/main.server.ts`](https://github.com/SebastianKohler/ng22-ion9-ssr-starter/blob/d012cb4a9c8942ded25b95de37b6ceede87edfa9/src/main.server.ts)
- [`src/app/app.config.server.ts`](https://github.com/SebastianKohler/ng22-ion9-ssr-starter/blob/d012cb4a9c8942ded25b95de37b6ceede87edfa9/src/app/app.config.server.ts)
- [`src/app/app.routes.server.ts`](https://github.com/SebastianKohler/ng22-ion9-ssr-starter/blob/d012cb4a9c8942ded25b95de37b6ceede87edfa9/src/app/app.routes.server.ts)
- [`tsconfig.app.json`](https://github.com/SebastianKohler/ng22-ion9-ssr-starter/blob/d012cb4a9c8942ded25b95de37b6ceede87edfa9/tsconfig.app.json)
- [`tsconfig.spec.json`](https://github.com/SebastianKohler/ng22-ion9-ssr-starter/blob/d012cb4a9c8942ded25b95de37b6ceede87edfa9/tsconfig.spec.json)
- [`src/app/app.spec.ts`](https://github.com/SebastianKohler/ng22-ion9-ssr-starter/blob/d012cb4a9c8942ded25b95de37b6ceede87edfa9/src/app/app.spec.ts)

### What should be copied conceptually

The starter demonstrates the intended Stage 2 architecture:

- `@angular/build:application` for the integrated browser/server build.
- `browser` and `server` application entries in the same build target.
- `outputMode: "server"`.
- `ssr.entry` pointing to the custom Express server.
- `AngularNodeAppEngine` for localized SSR dispatch.
- `createNodeRequestHandler()` and `writeResponseToNodeResponse()`.
- ESM-compatible server code using `import.meta` and `isMainModule()`.
- `provideServerRendering(withRoutes(...))`.
- `ServerRoute` + `RenderMode`.
- `IonicServerModule` retained only through `importProvidersFrom()`.
- localized production browser/server output.
- a generated `server.mjs` production entry point.
- `@angular/build:unit-test`.
- Vitest with `jsdom`.
- `vitest/globals` in `tsconfig.spec.json`.
- no Karma configuration file and no manual Angular TestBed bootstrap file.
- client hydration intentionally disabled.

### Where this application must intentionally differ

Do not copy the starter blindly.

- The starter contains a `RenderMode.Prerender` proof route. This application must not introduce Angular prerendering in Stage 2.
- The starter redirects an unprefixed production request using `Accept-Language`. This application currently serves Swedish as the unprefixed default and must preserve that behavior unless a separate breaking change is approved.
- The starter has a simple static localhost allowlist. This application derives allowed hosts from fork configuration and has existing proxy/origin rules that must remain equivalent.
- The starter has no authentication-specific CSR routing. This application must generate `RenderMode.Client` entries for auth-protected routes.
- The starter has a small Vitest suite. It is a model for test infrastructure, not proof that this application's larger Jasmine suite will migrate without manual work.
- The starter does not contain this application's `src/ionicons-polyfill.ts`. That omission is **not** part of the target architecture: the starter was created without the standalone-Ionic Ionicons registration workaround, while this application requires the polyfill so app-owned Ionicons are registered before `<ion-icon>` upgrades. Stage 2 must retain the polyfill.
- The starter's i18n model has one real source locale and one translated locale. This repository intentionally uses the non-production `aa` locale as a technical source locale. The base app currently produces Swedish and Finnish as translated locales, while forks can define different production locale sets; Stage 2 must preserve both the `aa` source-locale strategy and fork-configurable production locales.
- For Angular CLI-owned entry/configuration files, prefer the modern CLI layout where it improves consistency. In particular, Stage 2 should move the root `server.ts` to `src/server.ts` in a dedicated mechanical commit before the builder cutover. Do not reorganize application feature folders merely to resemble a fresh CLI project.

When implementation choices are otherwise equivalent, prefer the starter's Angular-native structure over preserving a legacy Stage 1 pattern. The Ionicons polyfill is an explicit exception: preserve this repository's working implementation even though the starter does not have it.


### File-layout modernization policy

The repository's high-level structure originates from an older Angular CLI generation. Stage 2 may modernize framework-owned file locations where that makes the final application-builder setup easier to understand and closer to a fresh Angular application.

This does **not** authorize a general source-tree reorganization. Existing locations for components, directives, pipes, services, pages, guards, interceptors, and other application-owned feature code are out of scope.

Every file-location migration must be isolated in its own commit:

- The commit should perform only the move plus the minimum mechanical import/config/script path updates required for the moved file to keep working.
- Do not combine a file move with API changes, refactoring, formatting, test conversion, builder changes, or behavior changes.
- Verify the application before and after the move so reviewers and fork maintainers can distinguish relocation conflicts from functional migration conflicts.
- Prefer Git-aware moves/renames and avoid unrelated line changes, so downstream forks have the best chance of recognizing the rename.

#### Move `server.ts` to the modern CLI location

Stage 2 should move:

~~~text
server.ts -> src/server.ts
~~~

Do this **before** the atomic application-builder cutover, while the legacy server builder still works.

The relocation commit may update only the paths required by the move, for example:

- imports inside `server.ts`,
- the legacy `angular.json` server target's `main` path,
- TypeScript includes if needed,
- scripts/tests/docs that refer directly to the source-file location.

Do not convert `CommonEngine` to `AngularNodeAppEngine` in the relocation commit.

Verify the full existing SSR gate after the move.

Suggested commit:

~~~text
chore(ssr): move server entry under src
~~~

After that commit, the application-builder cutover should use:

~~~json
"ssr": {
  "entry": "src/server.ts"
}
~~~

matching the modern Angular CLI/reference-app structure.

#### Public assets require a narrower migration

A fresh Angular application uses a top-level `public/` directory for files copied as public static assets. At the Stage 2 baseline, this repository's `src/assets/` directory mixed two different kinds of content. Phase 17 relocates these as recorded in its implementation checkpoint below.

Source/build inputs that should stay under `src/`:

- `src/assets/config/config.ts`
- `src/assets/custom_css/custom.scss`

These files are imported or compiled as source and must **not** be moved into `public/`.

Static assets that are candidates for `public/`:

- `src/assets/fonts/`
- `src/assets/images/`
- `src/assets/ebooks/`
- `src/assets/files/`
- `src/assets/icon/favicon.ico`

Other copied static files are also candidates:

- `src/robots.txt`
- `src/sitemap.txt`
- `src/static-html/`

Moving these files is not required for the `application` builder or Vitest migration. It is a layout modernization with significant downstream conflict potential because forks commonly add or replace static assets and may modify build configuration.

Therefore:

- Do not mix the public-folder migration into the application-builder cutover.
- Perform it only after the builder/SSR and Vitest migrations are stable.
- Use one or more dedicated mechanical commits containing only moves and required path-reference updates.
- Preserve public URLs. For example, assets currently served as `/assets/...` must remain `/assets/...` after moving their source files.
- Preserve generated-output behavior for sitemap/static HTML; if generator output paths move from `src/` to `public/`, that path update belongs in the same dedicated location-move commit and must not change generation logic.
- Re-run route generation, sitemap/static-menu generation, development build, production SSR build, SSR smoke tests, and Docker/nginx verification after each move.
- Document the move clearly for forks because conflicts in `angular.json`, fork-specific images/fonts/files, and generated/static content are expected.

Because of the fork conflict cost, Stage 2 should treat the `public/` move as a **separate optional modernization checkpoint**, not a prerequisite for declaring the application-builder/Vitest migration successful.

### Ionicons polyfill must be retained

`src/ionicons-polyfill.ts` centrally registers the application-owned Ionicons with `addIcons()` before Ionic defines/upgrades `<ion-icon>` elements.

This ordering matters for the standalone Ionic + SSR setup. Existing server-rendered `<ion-icon>` elements can upgrade before component constructors run, so relying on component-local icon registration can leave icons unresolved.

Stage 2 rules:

- Keep `src/ionicons-polyfill.ts`.
- Keep it in the application polyfill/bootstrap path when converting `angular.json` to `@angular/build:application`.
- Do not replace it with component-local `addIcons()` calls.
- Do not remove it merely because the reference starter works without one; the starter is incomplete as a reference for this specific concern.
- Keep application-owned icon registration centralized in this file.
- Verify representative icons after the application-builder cutover in development, production SSR, and client startup.
- When migrating tests to Vitest, ensure the same registration runs in tests without duplicating the icon list. Prefer inheriting the application polyfill through Angular's unit-test builder; if that does not occur, import `src/ionicons-polyfill.ts` once through a minimal test setup file.

### Why `aa` must remain the source locale

The `aa` locale is an intentional technical convention, not a real production locale.

- The source phrases represented by `aa` are Swedish.
- `aa` is never intended to be built, routed to, or exposed as a production locale.
- Production output is localized to `sv` and `fi`.
- Swedish deliberately remains a translated locale rather than Angular's source locale.
- Forks need to customize Swedish phrases as well as Finnish phrases. Keeping `sv` in the normal translation pipeline lets a fork override Swedish through the same XLF-based workflow used for other locales, instead of requiring source-template changes.
- Therefore, making `sv` the Angular `sourceLocale` would be an architectural regression even if it appears simpler or more conventional.

Stage 2 must preserve this separation:

~~~text
technical source locale:  aa
base production locales:  sv, fi
fork production locales:  configured per fork
source phrase language:   Swedish
~~~

When adapting the reference starter's i18n configuration to the application builder:

- keep `sourceLocale` as `aa`,
- in the base repository, keep `sv` and `fi` as explicit translated locales,
- in forks, preserve the fork's configured translated locale set rather than replacing it with the base repository's locales,
- continue building/localizing only the configured production locales,
- do not emit an `aa` production application,
- preserve the existing XLF merge/update workflow,
- verify that forks can continue overriding Swedish translations without modifying application source strings.

### Fork locale variability and merge expectations

The base repository's locale set is not a universal runtime contract. Forks intentionally modify `angular.json` and may have, for example:

- only `sv`,
- `sv` + `en`,
- `sv` + `fi`,
- `sv` + `en` + `fi` + `ar`.

This means Stage 2 should expect `angular.json` conflicts when the migration is later synced to forks. Those conflicts are normal and should be resolved by combining the **structural** Stage 2 builder/test changes with the fork's own locale configuration.

Stage 2 implementation rules:

- Do not hardcode a production locale array such as `["sv", "fi"]` in the new SSR runtime.
- Let the application builder and `AngularNodeAppEngine` use the localized applications emitted from the fork's own `angular.json` configuration.
- Keep the unprefixed/default-language compatibility behavior driven by `config.app.i18n.defaultLanguage`, not by a hardcoded `sv` literal or by assuming the first two locales are Swedish and Finnish.
- Keep `config.app.i18n.languages` and `config.app.i18n.defaultLanguage` consistent with the fork's production locales.
- Production scripts and runtime code must support one locale as well as multiple locales.
- Base-repository smoke tests may use `sv` and `fi` because those are the base app's configured locales, but reusable tooling should accept fork-specific routes/locales rather than requiring those exact language codes.
- Do not make runtime behavior depend on the number or names of translated locales.
- Do not emit the technical `aa` source locale in any fork unless a fork explicitly changes the source-locale strategy as a separate architectural decision.

The current `proxy-server.js` hardcodes `["sv", "fi"]`. That is a legacy Stage 1 limitation and must not be reproduced in the application-builder runtime.

To reduce downstream merge pain, keep the Stage 2 `angular.json` transformation concentrated in the application-builder and Vitest cutover commits instead of mixing unrelated formatting or locale reordering into those files.

When syncing Stage 2 to a fork, the expected `angular.json` resolution is:

1. retain the Stage 2 builder, SSR, dev-server, test, and i18n-extraction structure,
2. retain `sourceLocale: "aa"` unless the fork deliberately uses a different source-locale architecture,
3. reapply the fork's own `i18n.locales`, translation files, subpaths/base hrefs, and locale-specific build configurations,
4. verify that every locale in `config.app.i18n.languages` has the intended production build and that `defaultLanguage` is one of those production locales,
5. run the fork's own SSR/i18n verification matrix after resolving the conflict.

---

## Stage 2 goals

Primary goals:

- Replace the Webpack-based `browser` and `server` builders with Angular's integrated `application` builder.
- Replace Jasmine/Karma unit testing with Vitest using Angular's `@angular/build:unit-test` integration.

Supporting goals:

- Replace `CommonEngine` with `AngularNodeAppEngine`.
- Make the application server fully ESM-compatible.
- Replace the Express middleware workaround for auth-protected CSR routes with Angular server routes using `RenderMode.Client`.
- Use `RenderMode.Server` for routes that continue to use runtime SSR.
- Preserve feature-based route generation and make it the source for generated server-rendering metadata as well.
- Keep the existing Docker/nginx deployment model working.
- Keep the base app's Swedish and Finnish localization behavior working while keeping the build/runtime compatible with fork-defined production locale sets.
- Preserve the current unprefixed Swedish-default behavior.
- Preserve the current public URL structure and SEO behavior.
- Migrate i18n extraction to the `@angular/build` toolchain so `@angular-devkit/build-angular` can be removed after Karma is gone.
- Remove build and test artifacts that exist only for the old split-builder/Karma architecture.

---

## Non-goals and invariants

Do not combine unrelated architectural migrations with Stage 2.

Keep all of the following unless a specific Stage 2 step says otherwise:

- Standalone application bootstrap.
- Zoneless change detection.
- Standalone Ionic component imports.
- `importProvidersFrom(IonicServerModule)` as the intentional Ionic server-provider bridge.
- Existing route URLs, route hierarchy, guards, route data, and lazy-loading behavior.
- Existing feature-based route filtering.
- Existing optional authentication model.
- Existing token storage strategy.
- Existing sitemap and static collection-menu generation.
- Existing nginx front-end and Docker deployment model.
- Existing SSR rate limiting and Express proxy trust configuration.
- Existing Express short-circuit strategy for static content, missing static files, `/static-html`, and non-SSR probe requests; these requests should continue to avoid Angular rendering work.
- Existing static-file cache policy unless the new runtime requires an equivalent implementation change.
- Critical CSS inlining remains disabled (`optimization.styles.inlineCritical: false`) so Stage 2 does not change SSR response-generation cost while changing the build/runtime architecture.
- Existing canonical/Open Graph URL semantics.
- Existing source-language and translated-language behavior, including fork-specific production locale sets.
- Centralized app-owned Ionicons registration through `src/ionicons-polyfill.ts`.

Do **not** enable client hydration in Stage 2. Ionic's underlying Stencil components do not currently support Angular SSR hydration, and hydration must remain a separate migration.

Do **not** add Angular prerendering/SSG merely because the `application` builder and the reference starter support it. Stage 2 should use runtime SSR plus explicit CSR routes. The app's existing static HTML generation remains separate.

Do **not** enable critical CSS inlining during Stage 2. The current `inlineCritical: false` setting is intentional for SSR performance and must survive the application-builder migration even if the new builder's defaults or migration schematic would otherwise inline critical CSS. Evaluating whether critical CSS inlining is beneficial is a separate future performance experiment that should measure both SSR/server cost and client rendering impact before changing this setting.

Do **not** silently change the behavior of unprefixed URLs.

Do **not** add Vitest browser mode by default. The Stage 2 target is the Angular CLI default Node + `jsdom` setup used by the reference starter. Add a browser provider such as Playwright only if a specific test cannot be made meaningful in `jsdom`.

Do **not** add a custom `vitest.config.ts` unless a repository-specific need is demonstrated. Prefer Angular CLI test options first.

---

## Migration-critical current behavior

Stage 2 starts from these Stage 1 assumptions:

- Browser entry: `src/main.ts`.
- Server bootstrap entry: `src/main.server.ts`.
- Custom Express server: `server.ts`.
- Browser build output: `dist/app/browser/{sv,fi}`.
- Server build output: `dist/app/server/{sv,fi}/main.js`.
- Runtime launcher: `dist/app/proxy-server.js`.
- `proxy-server.js` currently hardcodes `sv` and `fi`, loads one compiled server bundle per locale, and uses Swedish as the unprefixed default. This fixed locale list is a legacy limitation; Stage 2 must not carry it into the new runtime.
- `server.ts` uses `CommonEngine` and passes request-level providers manually.
- Auth-protected routes are detected from generated top-level route metadata and are served as a CSR shell by Express middleware.
- nginx serves static browser files from the `dist/app/browser` volume and proxies dynamic requests to the Node app.
- `build:ssr` currently runs route generation, a browser production build, a separate server production build, and `postbuild-copy-files.js`.
- Production browser optimization explicitly sets `optimization.styles.inlineCritical` to `false`; this is a deliberate SSR performance choice, not legacy configuration to discard during the builder migration.
- `serve:ssr` currently starts `dist/app/proxy-server.js`.
- Unit tests use `@angular-devkit/build-angular:karma`, Jasmine, Karma, and headless Chrome.
- `src/ionicons-polyfill.ts` is an application polyfill and centrally registers app-owned Ionicons before `<ion-icon>` elements upgrade.
- `src/test.ts` manually initializes Angular's browser testing environment and also imports `ionicons-polyfill.ts` so the same icon registration is available to Karma tests.
- The Karma test target duplicates application assets/styles rather than inheriting them from the build target.
- The suite has no remaining Angular `fakeAsync`/`tick` dependency, but it does contain Jasmine-specific spies, matchers, property spies, and `jasmine.clock()` timer tests.
- `ng-extract-i18n-merge` is configured to call `@angular-devkit/build-angular:extract-i18n` even though the installed plugin version supports `@angular/build:extract-i18n`.

Stage 2 must account for all of these contracts rather than treating `angular.json` as the only migration surface.

---

# Test gates

Use these gates consistently so every commit has a clear stopping point.

## Fast gate before the Vitest cutover

~~~powershell
npm run test:source-encoding
npm run test:routes-parser
npm run test:ci
npm run generate-routes
npx ng build --configuration development,sv
~~~

Before the test-runner migration, `npm run test:ci` uses Jasmine/Karma.

## Fast gate after the Vitest cutover

Keep the same command surface:

~~~powershell
npm run test:source-encoding
npm run test:routes-parser
npm run test:ci
npm run generate-routes
npx ng build --configuration development,sv
~~~

After the test-runner migration, `npm run test:ci` must run Vitest once through Angular CLI.

The npm script name should remain stable so CI/developer habits do not change unnecessarily.

## Full SSR gate

~~~powershell
npm run build:ssr
npm run serve:ssr
~~~

Then, from another terminal:

~~~powershell
npm run test:ssr:smoke
~~~

At minimum confirm server-rendered initial HTML for:

- `/sv/`
- `/sv/collection/203/introduction`
- `/sv/index/persons`
- one Finnish route.

Also confirm canonical URL, Open Graph URL, locale-specific HTML, HTTP status, and content type.

## Auth-rendering gate

Run with auth both disabled and enabled.

When auth is disabled:

- normal application routes continue to use SSR,
- auth-only routes remain unavailable according to current route guards/configuration.

When auth is enabled:

- routes currently identified as auth protected are client rendered,
- public routes continue to use SSR,
- protected routes do not leak protected server-rendered content,
- login/register/account behavior remains unchanged.

## Test-runner parity gate

Immediately before the Vitest cutover, record:

- number of passing spec files,
- number of passing tests,
- any intentionally skipped tests,
- approximate suite duration.

Immediately after the cutover:

- the same spec files should run unless an intentional test consolidation is documented,
- the same behavioral assertions should remain,
- no tests should be deleted merely to make the migration pass.

Also verify:

~~~powershell
npm test
~~~

Watch mode should remain useful for local development.

Optionally verify coverage still works:

~~~powershell
npx ng test --watch=false --coverage
~~~

There is currently no Stage 2 goal to introduce new coverage thresholds.

## Container gate

~~~powershell
docker build -t digital-edition-frontend-ng:stage2-test .
docker run -it -p 4201:4201 --rm digital-edition-frontend-ng:stage2-test
~~~

Then run the SSR smoke test against the container.

Also test the nginx front-end:

~~~powershell
docker compose up -d
~~~

Verify static assets, SSR routes, gzip-static behavior, forwarded protocol/host handling, and both locales.

## Manual browser gate

At relevant milestones test:

- Desktop and mobile navigation.
- Ionic outlet history and cached-page behavior.
- Side menus and loading bar.
- Collection navigation and text views.
- Search, index, media collection, and ebooks.
- Modals, popovers, filters, and image viewers.
- Authentication flows when enabled.
- Swedish and Finnish.
- Direct navigation and browser refresh on lazy routes.
- Unprefixed URLs and locale-prefixed URLs.

## Performance gate

Before Stage 2 starts, retain a benchmark result:

~~~powershell
npm run bench:ssr:build
~~~

Run the same benchmark after the migration. Treat the result as diagnostic rather than a rigid pass/fail threshold, but investigate material regressions before completing Stage 2.

---

# Commit-by-commit migration plan

## 1. Establish the Stage 2 baseline

Do not change runtime behavior yet.

Work:

- Run the pre-Vitest fast gate.
- Run the full SSR gate.
- Run the auth-rendering gate.
- Run the container gate.
- Run the SSR benchmark and retain the result.
- Record the current `dist/app` tree.
- Record the Jasmine/Karma test-runner parity data.
- Confirm generated route artifacts are cleanly reproducible.
- Confirm `CommonEngine` is still the active runtime.
- Confirm hydration is not configured.
- Confirm the working tree is clean after generation/build commands.

Record specifically:

- filenames under `dist/app/server`,
- locale directory layout,
- browser output layout,
- unprefixed URL behavior,
- `/sv` and `/fi` behavior,
- static-file caching headers,
- CSR-shell response behavior for auth-protected routes,
- current unit-test file/test counts.

Commit:

- No commit if no files change.
- If migration-specific baseline tests are added:

~~~text
test(migration): capture Stage 2 baseline
~~~

---

## 2. Add migration-specific regression coverage

Add coverage before touching the server runtime or test runner.

Work:

- Extend SSR smoke coverage so it can distinguish SSR output from the CSR shell.
- Add at least one Finnish route to automated SSR smoke coverage.
- Add regression coverage for:
  - canonical URL under direct requests,
  - canonical URL behind forwarded HTTPS,
  - Open Graph URL,
  - known missing static-file behavior,
  - `/static-html` missing-file behavior,
  - root/default-language behavior.
- Add or extend unit coverage for public-origin resolution.
- Add focused tests for auth-protected path extraction from route generation.
- Cover auth disabled and auth enabled.
- Cover feature-based route filtering together with auth-protected path extraction.
- Add tests that prove parameterized auth paths are preserved in generated metadata.

Where practical, add a small build-output assertion script that verifies only stable output contracts such as:

- `dist/app/browser` exists,
- both configured locale browser directories exist,
- the expected runtime server entry exists.

Do not make the test depend on hashed browser bundle names.

Verify:

- Pre-Vitest fast gate.
- Full SSR gate.
- No intentional production behavior change.

Commit:

~~~text
test(migration): lock SSR and build-system contracts
~~~

---

## 3. Decouple runtime tooling from the legacy proxy filename

Prepare tooling so the server entry can change later without requiring every consumer to know its output filename.

Work:

- Change the Docker runtime command to start the app through the npm `serve:ssr` script rather than directly hard-coding `dist/app/proxy-server.js`.
- Update `scripts/benchmark-ssr.js` so its auto-start path uses the canonical SSR start command rather than assuming `dist/app/proxy-server.js`.
- Keep `serve:ssr` itself unchanged in this commit, so behavior remains identical.
- Keep the existing browser volume path and nginx configuration unchanged.

Verify:

- Pre-Vitest fast gate.
- Full SSR gate.
- Benchmark still auto-starts the current SSR server.
- Container gate.

Commit:

~~~text
build(ssr): decouple tooling from proxy server filename
~~~

This commit remains fully compatible with the Stage 1 builders.

---

## 4. Decouple application services from Express request objects

The current `CommonEngine` path injects an Express `Request` using the repository-owned `src/express.tokens.ts`. `AngularNodeAppEngine` provides Angular's built-in SSR request context using the standard Web `Request` API.

Prepare that API boundary before switching builders.

Work:

- Introduce a small application-level request-context abstraction rather than letting Angular application services depend directly on Express.
- Keep the abstraction limited to values the app actually needs, for example:
  - request URL/path,
  - public origin,
  - user-agent.
- Refactor direct Express request consumers:
  - `PlatformService`,
  - `DocumentHeadService`,
  - `ServerRouterNavigationSourceService`,
  - request-origin helpers as appropriate.
- Keep the current Stage 1 server implementation working by providing the abstraction from the existing Express request token.
- Preserve browser behavior.
- Preserve canonical/Open Graph URL behavior.
- Preserve user-agent-based mobile/desktop detection.

Tests:

- Server request URL with locale prefix.
- Query-string handling.
- Forwarded host/protocol.
- Configured public origin.
- Localhost fallback.
- User-agent propagation.
- Missing request context.
- Browser fallback behavior.

Verify:

- Pre-Vitest fast gate.
- Full SSR gate.
- Canonical/Open Graph assertions.
- Mobile/desktop SSR mode parity.

Commit:

~~~text
refactor(ssr): isolate application request context
~~~

The builder-cutover commit should then only replace the server-side adapter, not rewrite application services.

---

## 5. Generate Angular server-rendering route metadata

Prepare future `RenderMode` configuration while the existing Express CSR-shell workaround is still active.

Extend route generation so the same canonical route source controls browser routing and server rendering mode.

Preferred design:

- Continue generating `app.routes.generated.ts`.
- During the transition, continue generating `auth-protected-route-paths.generated.ts`.
- Add a generated server-route artifact, for example `src/app/app.routes.server.generated.ts`.
- Add the new generated artifact to `.gitignore`.

The generated server routes should represent:

- auth-disabled mode:
  - wildcard fallback -> `RenderMode.Server`.
- auth-enabled mode:
  - every included top-level auth-protected route -> `RenderMode.Client`,
  - wildcard fallback -> `RenderMode.Server`.

Rules:

- Client-rendered routes must appear before the wildcard server route.
- Feature-based route filtering must be applied before server routes are generated.
- Routes excluded from the production browser route set must not reappear in server rendering metadata.
- Parameterized paths must remain parameterized.
- Do not introduce `RenderMode.Prerender` even though the reference starter demonstrates it.
- Keep the existing auth-protected path output until the new runtime is active.

Tests:

- Auth disabled -> no client server routes.
- Auth enabled -> correct client server routes.
- Feature filtering + auth enabled.
- Parameterized collection routes.
- `index/:type`.
- Lazy top-level paths.
- Wildcard `RenderMode.Server` is always last.
- A second generation produces no changes.

Verify:

- `npm run test:routes-parser`.
- Pre-Vitest fast gate.
- Full SSR gate using the old runtime.

Commit:

~~~text
feat(routes): generate server rendering modes
~~~

The new generated server-route file is intentionally unused by production until the builder cutover.

---

## 6. Rehearse the application-builder migration against the starter and Angular schematic

Do this immediately before the real builder switch because Angular's migration schematic can change between releases.

Use a temporary branch or worktree.

### 6.1 Recheck the reference starter

Compare the current starter to the recorded `d012cb4...` snapshot.

Review:

- `angular.json` application build options,
- localized production output,
- generated `server.mjs` entry,
- `src/server.ts`,
- top-level `public/` asset handling,
- `app.config.server.ts`,
- `app.routes.server.ts`,
- TypeScript module settings,
- npm scripts.

Document any relevant divergence that appeared after the recorded snapshot.

### 6.2 Run Angular's official migration

Run:

~~~powershell
npx ng update @angular/cli --name use-application-builder
~~~

Do **not** merge the schematic output directly.

Compare it with both this repository and the starter.

Review especially:

- final application-builder package/name,
- `main` -> `browser`,
- integrated `server` option,
- `ssr.entry`,
- `outputMode`,
- `prerender`,
- output-path structure,
- removed legacy builder options,
- removal of separate `server`, `serve-ssr`, and `prerender` targets,
- TypeScript config merge,
- `module`/`moduleResolution` changes,
- `esModuleInterop` if introduced,
- ESM server entry style,
- server-route configuration,
- changes to i18n configuration.

Do not assume the starter's `sourceLocale`/`subPath` values should replace this application's current i18n configuration. Preserve `aa` as the non-production technical source locale and keep both `sv` and `fi` in the translation pipeline; in particular, do not promote `sv` to `sourceLocale` during the migration.

Commit:

- No production commit.
- If the plan itself needs correcting:

~~~text
docs(migration): update Stage 2 plan for current Angular CLI
~~~

### 6.3 Rehearsal results (2026-10-06)

The rehearsal used application commit `0b24937` (the merged phase 5), the locked Angular CLI/schematics/build/SSR version `22.2.1`, and an isolated worktree. The reference starter's current `main` was still `d012cb4a9c8942ded25b95de37b6ceede87edfa9`; there was no divergence from the recorded snapshot.

The exact command in step 6.2 completed successfully, including its package-install tasks. Its output is a starting point for review, not a runnable drop-in migration:

| Surface | Observed schematic output | Required cutover decision |
| --- | --- | --- |
| Build targets | `@angular/build:application` and `@angular/build:dev-server`; `main` becomes `browser`; integrates `src/main.server.ts` and `ssr.entry: src/server.ts`; sets `outputMode: server`; removes the separate `server`, `serve-ssr`, and `prerender` targets | Keep this integrated structure, with the server relocation already committed separately in step 7 |
| Output/options | Changes `dist/app/browser` to `outputPath: { base: "dist/app" }`; removes `buildOptimizer`/`vendorChunk`; retains assets, styles, budgets, file replacements, translation policy, and `inlineCritical: false` | Preserve these repository inputs; verify the emitted tree before updating runtime consumers |
| TypeScript | Merges server entries into `tsconfig.app.json`, deletes `tsconfig.server.json`, adds `esModuleInterop`, removes `allowSyntheticDefaultImports`; leaves `module: ES2022` and `moduleResolution: bundler` | Preserve strictness, path aliases, localization/Node types, and extended diagnostics; no wholesale starter-tsconfig replacement is needed |
| Custom server | Deletes root `server.ts` and creates the generic ESM Express/`AngularNodeAppEngine` template at `src/server.ts`, listening on port 4000 by default | Reapply this application's middleware, port 4201, proxy/origin, rate-limit, static-cache, and unprefixed-default-locale contracts in step 9 |
| Server providers | Leaves `app.config.server.ts` and `src/main.server.ts` unchanged; does not wire the generated server routes | Import `provideServerRendering`/`withRoutes` from `@angular/ssr` and consume the phase 5 metadata before the first integrated build; retain the Ionic bridge and service overrides |
| Security | Adds `security.allowedHosts: []`; the generated engine has no custom host/proxy options | Explicitly restore configuration-derived allowed hosts and trusted proxy-header handling; this is not equivalent to either this application's policy or the starter's loopback allowlist |
| Scripts/dependencies | Removes `build:ssr`/`serve:ssr`, adds `serve:ssr:app`, leaves dependent scripts referring to the removed names; removes `@angular-devkit/build-angular`; lowers Express/type dependency ranges to template defaults | Restore the stable script names and keep existing dependency ranges unless a separate change is justified; retain build-angular while legacy Karma and the extraction wrapper require it |
| Unit testing/extraction | Changes the test builder to `@angular/build:karma` and removes its old Karma plugin, but leaves the old framework name and test bootstrap; leaves `ng-extract-i18n-merge`'s nested `builderI18n` pointing to build-angular | Keep the complete legacy Karma setup until the separate Vitest cutover; update the extraction wrapper explicitly in step 10 |
| Localization | Preserves technical source locale `aa`, explicit translated production locales `sv`/`fi`, their XLF paths, and the old `baseHref` properties | Convert equivalent locale paths to `subPath` during the builder cutover, preserving each fork's actual paths and locale set |

The unmodified schematic output failed its production build with `Could not resolve "zone.js/node"`. Angular 22.2.1's application builder uses a polyfill-name heuristic: any polyfill entry ending in `.ts`/`.js` is treated as potentially Zone-based. This includes the existing `src/ionicons-polyfill.ts`, even though it does not import Zone.js. An extensionless `src/ionicons-polyfill` entry resolved the same file and avoided the implicit Zone.js server import. Retain the file and its early registration behavior; do not install Zone.js or remove Ionicons to bypass this failure.

With extensionless Ionicons and explicit `@angular/localize/init` polyfills, the next build failed because routes without server-route metadata defaulted to prerendering, including parameterized routes without `getPrerenderParams`. `outputMode: server` alone does not mean every route uses runtime SSR. The generated `RenderMode.Server`/`RenderMode.Client` metadata must be wired as part of the atomic cutover.

The schematic's Karma configuration also failed: it executed only 132 of 265 tests, reported 40 failures including `$localize is not a function`, then disconnected. This confirms that its automatic test-builder/plugin changes must not be accepted while preserving the pre-Vitest test gate.

A controlled production-build probe then passed with only these additional changes in the disposable worktree:

- `polyfills: ["@angular/localize/init", "src/ionicons-polyfill"]`, retaining the existing TypeScript file;
- the phase 5 `serverRoutes` supplied through `provideServerRendering(withRoutes(serverRoutes))` from `@angular/ssr`;
- locale `baseHref: "sv/"`/`"fi/"` replaced by equivalent `subPath: "sv"`/`"fi"` values.

The probe emitted zero prerendered routes, browser files under `dist/app/browser/{sv,fi}`, localized server bundles under `dist/app/server/{sv,fi}`, and the shared runtime entry `dist/app/server/server.mjs`. No `aa` production directory was emitted. The browser CSR shells are named `index.csr.html`; deployment/output checks must account for that rather than assuming `index.html` is present.

This successful build validates the configuration direction only. The template server still lacks the application's required runtime behavior, and the request-context adapter and HTTP status handling still need the step 9 migration. It is not an SSR/auth/container parity result. No schematic or probe changes should be merged into production. The rehearsal log, original schematic patch, probe configuration, and output inventory are retained locally under ignored `tmp/stage-2-phase-6/`.

---


## 7. Move the SSR server entry under `src/`

Modernize the server-entry location in a dedicated mechanical commit before changing builders.

Move:

~~~text
server.ts -> src/server.ts
~~~

Allowed changes in this commit:

- update imports inside the moved file for its new relative location,
- update the legacy `angular.json` server target from `server.ts` to `src/server.ts`,
- update TypeScript/source includes only if required,
- update scripts/tests/docs only where they refer directly to the source-file path.

Not allowed in this commit:

- no `CommonEngine` -> `AngularNodeAppEngine` conversion,
- no builder change,
- no middleware behavior change,
- no unrelated ESM refactor,
- no formatting-only cleanup.

Verify:

- Pre-Vitest fast gate.
- Full SSR gate.
- Auth-rendering gate.

Commit:

~~~text
chore(ssr): move server entry under src
~~~

This gives the later application-builder cutover the same `src/server.ts` entry-point convention as a modern Angular CLI SSR app and the reference starter.

---

## 8. Prepare TypeScript and source code for the ESM server build

Make ESM-safe changes that are harmless under the Stage 1 builders before changing `angular.json`.

Work:

- Apply only TypeScript configuration changes that are both migration-required and safe under the current builder.
- Audit application/server imports for CommonJS-call assumptions.
- Prefer ESM-compatible imports for packages used by server code.
- Check Node built-in imports.
- Check code for:
  - `require(...)`,
  - `__filename`,
  - `__dirname`,
  - `__non_webpack_require__`,
  - Webpack-specific globals or comments.
- Do not remove the current `src/server.ts` main-module logic yet if doing so would break the old server builder.
- Do not set `"type": "module"` in `package.json` merely to force ESM.

Use the starter's `tsconfig.json` and `tsconfig.app.json` as references, but do not weaken this repository's strict compiler settings solely to make the configurations look alike.

Useful audit:

~~~powershell
rg "require\(|__filename|__dirname|__non_webpack_require__|webpack" src/server.ts src
~~~

Verify:

- Pre-Vitest fast gate.
- Full SSR gate using the old builder.

Commit:

~~~text
build(ssr): prepare server code for ESM output
~~~

If no safe pre-cutover changes are needed, skip this commit and keep ESM-only edits in the atomic cutover.

---

## 9. Atomic cutover to the application builder

This is the first deliberately larger commit.

Keep the existing Jasmine/Karma test target working in this commit. Do **not** combine the Vitest migration with the builder cutover.

### 9.1 Convert the application build target

Use the same architecture as the reference starter:

~~~json
"builder": "@angular/build:application"
~~~

Expected application options include:

~~~json
"browser": "src/main.ts",
"server": "src/main.server.ts",
"outputMode": "server",
"ssr": {
  "entry": "src/server.ts"
}
~~~

The server-entry relocation is completed in the preceding dedicated commit, so the builder cutover must not include a file move.

Translate existing options rather than re-creating configuration from scratch.

Retain:

- `index`,
- polyfills including the existing `src/ionicons-polyfill.ts` file; with the rehearsed Angular 22.2.1 builder, use its extensionless `src/ionicons-polyfill` entry plus `@angular/localize/init` so the builder does not implicitly add Zone.js server polyfills (see step 6.3). Keep the file, early registration order, and test initialization when matching the starter,
- assets,
- styles,
- localization,
- file replacements,
- translation warning/error behavior,
- production budgets,
- output hashing,
- `inlineCritical: false`; preserve this explicitly rather than relying on the application builder's default, because enabling it would change SSR build/rendering performance characteristics during the migration.

Remove options that are obsolete under the application builder, such as legacy `buildOptimizer` and `vendorChunk` settings.

Prefer preserving:

~~~json
"outputPath": {
  "base": "dist/app",
  "browser": "browser",
  "server": "server"
}
~~~

so Docker/nginx need fewer changes.

Use locale `subPath` values for the integrated localized SSR build rather than carrying over equivalent legacy `baseHref` properties, which Angular 22.2.1 warns may cause undefined SSR behavior. For the base app, `baseHref: "sv/"` maps to `subPath: "sv"` and `baseHref: "fi/"` maps to `subPath: "fi"`. Review fork-specific paths individually; preserve `sourceLocale: "aa"`, translation files, and the explicit production locale list.

The reference starter emits a production runtime at `server/server.mjs`. Expect this application to move toward `dist/app/server/server.mjs`, but verify the actual emitted tree before changing `serve:ssr`.

### 9.2 Remove legacy application Architect targets

The integrated application builder replaces the split SSR build.

Remove obsolete dedicated application targets after their behavior is represented in the application build:

- `server`,
- `serve-ssr`,
- `prerender`.

Keep the normal `serve` target using `@angular/build:dev-server` and point its configurations at the application build target.

Do not remove the legacy Karma test target yet.

Retain `@angular-devkit/build-angular:karma`, the build-angular dependency, and the existing `karma.conf.js` framework/plugin configuration through this cutover. Undo the schematic's automatic `@angular/build:karma` conversion and plugin removal; the phase 6 rehearsal demonstrated failures with that partial test-infrastructure migration. Jasmine test conversion and runner changes belong to the later Vitest phases.

### 9.3 Merge server TypeScript configuration

Follow the current Angular migration output and compare it with the reference starter.

Expected direction:

- merge required `tsconfig.server.json` settings into `tsconfig.app.json`,
- include browser and server TypeScript sources correctly,
- exclude specs from the app build,
- retain Node and localization types where required,
- retain extended diagnostics,
- remove `tsconfig.server.json` only after the integrated build succeeds.

Do not weaken strict compiler settings as a migration shortcut.

### 9.4 Wire Angular server routes

Update `app.config.server.ts` following the starter pattern:

~~~typescript
provideServerRendering(
  withRoutes(serverRoutes)
)
~~~

Use the generated server-route artifact from step 5.

Import `provideServerRendering` and `withRoutes` from `@angular/ssr`, replacing the old `@angular/platform-server` provider import. Wire the routes before attempting the integrated production build: `outputMode: "server"` does not by itself prevent Angular's default prerender route extraction from rejecting parameterized application routes.

Retain:

- `IonicServerModule` bridge,
- all server-specific service overrides.

Do not add hydration providers.

### 9.5 Preserve the Express performance pipeline

The application builder and `AngularNodeAppEngine` do **not** require removing the custom Express server. Angular's Node SSR API is designed to sit behind an Express middleware chain: middleware can short-circuit requests first, and the final Angular handler can call `angularApp.handle(req)` only for requests that actually need Angular rendering.

This is important for this application because much of the current `server.ts` middleware exists specifically to avoid unnecessary Angular SSR work.

Preserve the current middleware ordering and intent wherever possible:

- Configure Express `trust proxy` before middleware that depends on `req.ip`.
- Serve `/static-html` before Angular, with the existing cache policy.
- Keep the explicit fast 404 for missing `/static-html` files so the Angular wildcard route is not bootstrapped for those requests.
- Serve unversioned public files such as `robots.txt`, `sitemap.txt`, and `favicon.ico` before Angular, with the existing no-cache behavior.
- Serve public assets before Angular with the intended short-cache policy.
- Serve hashed browser output before Angular with long-term caching.
- Keep the fast missing-static-extension 404 before Angular so requests for missing images, fonts, media, PDFs, and similar files do not bootstrap SSR.
- Keep the Chrome DevTools probe bypass before the SSR rate limiter.
- Keep the SSR rate limiter immediately before the dynamic Angular handler so successfully served static files and intentional fast 404s do not consume SSR limiter capacity.
- Preserve `Vary: User-Agent` for dynamically rendered responses while user-agent-dependent SSR output remains in use.
- Preserve the existing static cache durations unless a separate measured performance change justifies changing them.

The target request pipeline should conceptually remain:

~~~text
request
  -> Express proxy/IP configuration
  -> special static-html handling
  -> unversioned static files
  -> public/static assets
  -> hashed browser files
  -> fast missing-static-file 404
  -> non-SSR probe bypasses
  -> SSR rate limiter
  -> dynamic-response headers
  -> AngularNodeAppEngine.handle(req)
  -> writeResponseToNodeResponse(...)
~~~

The exact static-file path matching will need to adapt to the application builder's localized browser output. Do not solve that by hardcoding `sv`/`fi`. The middleware must work with the locale directories emitted from each fork's own `angular.json` configuration, including single-locale forks.

Performance-sensitive middleware should remain in Express rather than being moved into Angular application code or Angular route guards. Requests that can be answered without bootstrapping Angular should continue to avoid Angular entirely.

Not every current `server.ts` branch should survive:

- Remove the manual auth-protected CSR-shell middleware once generated `RenderMode.Client` server routes provide the same behavior.
- Remove `clientRenderIndexHtml` and related synchronous index-file reads if they are no longer needed after that change.
- Remove manual `APP_BASE_HREF`, `LOCALE_ID`, and repository-owned Express `REQUEST` providers when the new localized engine/request-context model supplies their replacements.
- Remove the old per-locale `proxy-server.js`; `AngularNodeAppEngine` should own localized application dispatch.
- Replace only the final `CommonEngine.render()` boundary with the Angular Node app engine response flow.

Before changing this middleware, add or retain regression coverage for the short-circuit behavior. At minimum verify:

- existing file returns without invoking dynamic SSR,
- missing known static extension returns the expected fast 404,
- missing `/static-html` returns its explicit 404,
- DevTools probe returns 204 and does not consume SSR rate-limit capacity,
- dynamic SSR requests are rate limited,
- static requests are not SSR-rate-limited,
- cache-control behavior remains equivalent for unversioned files, assets, and hashed files,
- dynamic responses retain the expected `Vary` header.

Where practical, instrument or spy on the final Angular handler in focused server tests so these assertions prove that short-circuited requests never reach `AngularNodeAppEngine.handle()`.

Commit the Express adaptation as part of the atomic application-builder cutover only where required by the new output/runtime contract. Performance-policy changes should be separate later commits backed by measurements.

### 9.6 Replace CommonEngine with AngularNodeAppEngine

Rewrite only the final Angular rendering boundary in `src/server.ts` using the starter as the model; keep the performance-oriented Express middleware described above in front of it:

- `AngularNodeAppEngine`,
- `createNodeRequestHandler`,
- `writeResponseToNodeResponse`,
- `isMainModule(import.meta.url)` or the current Angular-recommended equivalent.

Requirements:

- no `CommonEngine`,
- no `__non_webpack_require__`,
- no CommonJS main-module assumptions,
- valid ESM server code,
- export the Node request handler expected by Angular CLI tooling,
- start the Express listener only when the emitted server entry is executed directly.

Instantiate `AngularNodeAppEngine` once.

Do not copy the starter's localhost-only security configuration blindly. Preserve this application's dynamic allowed-host behavior. Prefer passing the configured allowlist directly to `AngularNodeAppEngine` or using the equivalent supported Angular mechanism.

Also evaluate `trustProxyHeaders` explicitly. AngularNodeAppEngine does not blindly trust forwarded headers. The deployed app relies on nginx/upstream proxy headers for public protocol/host resolution, so trust only the exact forwarded headers supplied by the trusted proxy chain and verify that direct untrusted requests cannot spoof them.

Keep custom Express behavior that is still required:

- Express `trust proxy` for request-IP/rate-limit behavior,
- SSR rate limiting,
- `/static-html` behavior,
- special static-file handling,
- Chrome DevTools probe bypass,
- cache policy where Node directly serves files,
- `Vary: User-Agent` behavior if still required,
- configured public-origin behavior.

Do not duplicate static-file work unnecessarily if `AngularNodeAppEngine` handles a case equivalently; remove old middleware only after tests prove behavior is preserved.

### 9.7 Swap the request-context adapter

Replace the Stage 1 Express-request adapter introduced in step 4 with an adapter backed by Angular's built-in SSR `REQUEST` token and standard Web `Request`.

Verify:

- canonical URLs,
- Open Graph URLs,
- request path,
- locale stripping,
- user-agent,
- forwarded host/protocol behavior.

After this works, repository-owned Express request injection should no longer be needed by application services.

Also replace `PageNotFoundPage`'s repository-owned Express `RESPONSE` token with Angular's nullable `RESPONSE_INIT` token from `@angular/core`, setting the response status through its `ResponseInit` object. Preserve browser/build-time null handling and verify actual HTTP 404 responses; the new engine does not supply the old Express response provider.

### 9.8 Replace auth CSR middleware with RenderMode.Client

The generated server-route configuration now owns render mode.

Remove the Express middleware branch that manually sends the client index for auth-protected routes.

Verify:

- auth-protected routes use `RenderMode.Client`,
- public routes use `RenderMode.Server`,
- route filtering and auth feature flags remain synchronized,
- no protected SSR HTML leaks.

### 9.9 Update npm scripts

Expected end state:

- `build:ssr`:
  - generate routes,
  - run one integrated production `ng build`,
  - no separate `ng run app:server:production`,
  - no post-build copy of `proxy-server.js`.
- `serve:ssr`:
  - execute the application builder's emitted server entry, expected to be equivalent to the starter's `server/server.mjs` pattern.
- `ssr-start`:
  - remains build + serve.
- `bench:ssr:build`:
  - remains build + benchmark.

Do not guess the emitted server entry filename. Confirm it from the actual build output and use that path.

### Cutover verification

Before committing:

- Pre-Vitest fast gate.
- Full SSR gate.
- Auth-rendering gate.
- Swedish route.
- Finnish route.
- Unprefixed/default-language route.
- Canonical/Open Graph assertions.
- Missing-static-file assertions.
- No hydration provider.
- Production configuration still has critical CSS inlining disabled; inspect the migrated `angular.json` rather than assuming the old setting carried over.
- Representative app-owned Ionicons render correctly in server HTML and remain correct after client bootstrap.
- `npm run generate-routes` followed by a second generation produces no diff.
- Existing Jasmine/Karma unit suite still passes unchanged.

Commit:

~~~text
build(ssr): migrate to Angular application builder
~~~

Do not proceed if the production SSR workflow or existing unit suite is not fully usable at this commit.

### Phase 9 implementation checkpoint — 2026-10-06

The integrated builder now emits `dist/app/server/server.mjs` and Swedish/Finnish browser and server applications, with no technical `aa` output. The legacy proxy, post-build copy, separate server targets, and server tsconfig are removed. Generated server routes own auth-protected CSR rendering; Angular Web `REQUEST` and nullable `RESPONSE_INIT` replace repository-owned Express tokens. Jasmine/Karma, non-hydrated SSR, and `inlineCritical: false` are retained.

Locale dispatch and static middleware use the fork's configured subpaths and emitted locales. Unprefixed requests retain the configured default language without redirects. The CLI's single-locale in-memory development app uses its own base path. Proxy trust now requires both the configured hop limit and `app.ssr.trustedProxyAddresses`; deployments with public proxy addresses must configure their actual IPs/CIDRs. See [deployment notes](../../../DEPLOYMENT.md).

Verified with Node 24.20.0 and the locked Angular 22.2.1 toolchain:

- Pre-Vitest fast gate: source encoding, all 24 route-parser checks, all 267 Jasmine/Karma tests across 44 spec files, route generation, and `development,sv` build.
- Two consecutive generations produce identical browser, auth-path, and server-route artifacts.
- Production build and emitted-output check; all 32 SSR smoke cases pass with auth disabled and enabled. An additional auth-enabled HTTP matrix covers all 16 generated protected paths, public SSR, Finnish CSR, and unprefixed protected routes (43 responses, no rendering failures).
- All 17 focused server checks, 5 smoke-runner checks, and 4 benchmark startup/cleanup checks pass.
- Swedish and Finnish live development servers render the correct home content and SEO URLs. Representative application-owned Ionicons retain SVGs after production client bootstrap, with no browser console errors.

The default auth-disabled configuration is restored after the auth gate. Docker/nginx validation and the broader fork-localization matrix remain their dedicated later checkpoints.

---

## 10. Migrate i18n extraction to the @angular/build toolchain

Before phase 10, the `ng-extract-i18n-merge` configuration explicitly delegated to:

~~~text
@angular-devkit/build-angular:extract-i18n
~~~

The installed `ng-extract-i18n-merge` version supports `@angular/build:extract-i18n` and uses it as the modern default.

Change only the underlying extraction builder; preserve this repository's merge/sort/target-file behavior.

Work:

- Change `builderI18n` to `@angular/build:extract-i18n` or remove the override if the plugin's current default is confirmed equivalent.
- Keep:
  - `format`,
  - `outputPath`,
  - `sort`,
  - `targetFiles`,
  - existing source-language target behavior.
- Run extraction and inspect all XLF diffs.
- Ensure the migration itself does not reorder or rewrite translations unexpectedly.

Verify:

~~~powershell
npm run extract-i18n
~~~

Then:

- pre-Vitest fast gate,
- confirm no unintended XLF diff remains.

Commit:

~~~text
build(i18n): use application-builder extraction tooling
~~~

This removes one reason to retain `@angular-devkit/build-angular` after Karma is removed.

### Phase 10 implementation checkpoint — 2026-10-06

`builderI18n` now explicitly selects `@angular/build:extract-i18n`. The merge wrapper, application build target, XLIFF 2 format, output path, ID sorting, target files, and source-language behavior are retained. `@angular-devkit/build-angular` remains installed for the legacy Karma target.

Verification completed:

- `npm run extract-i18n` succeeds through the modern extraction builder.
- All four catalogs retain the same 443 message IDs in the same order, with unchanged source text, targets, translation states, descriptions, meanings, and context. Extracted files differ from the baseline only in CRLF/LF line endings; the original catalog bytes were restored, leaving no XLF diff.
- The pre-Vitest fast gate passes: source encoding (351 files), all 24 route-parser checks, all 267 Jasmine/Karma tests, route generation, and the `development,sv` build.

---

## 11. Stabilize localization and default-language serving

Treat localization as its own checkpoint because the old runtime explicitly started one server bundle per locale, while `AngularNodeAppEngine` manages localized applications internally.

Use the reference starter to understand the localized application-builder output and request dispatch.

Required behavior for this application:

- `/sv/...` serves Swedish.
- `/fi/...` serves Finnish.
- locale-specific browser assets resolve correctly.
- direct navigation works.
- browser refresh works.
- canonical/hreflang/Open Graph URLs use the correct locale.
- the existing unprefixed/default-language behavior remains Swedish unless a deliberate breaking change is approved.

Pay special attention to the difference from the starter: its unprefixed production URL redirects using `Accept-Language`. Do not adopt that behavior by accident.

Test:

- root page,
- nested lazy route,
- collection route,
- missing route/404,
- static asset,
- `robots.txt`,
- `sitemap.txt`,
- both locale prefixes,
- no prefix.

If Angular's localized engine introduces language negotiation at the root, add the smallest compatibility layer necessary to preserve the existing Swedish-default contract. Verify canonical URLs carefully if an internal rewrite is used.

Verify:

- Full SSR gate.
- Manual browser gate.
- Container gate.
- Existing Jasmine/Karma unit suite.

Commit only if code/configuration changes are required:

~~~text
fix(i18n): preserve locale routing with application builder
~~~

If no changes are required, record the verification and continue without a commit.

### Phase 11 verification checkpoint — 2026-10-06

The compatibility layer introduced in phase 9 already preserves the locale contract; no additional runtime or configuration changes are required. Unlike the reference starter's root language negotiation, this app internally dispatches unprefixed requests to the configured default locale. Swedish remains the default even with Finnish `Accept-Language` preferences, and the HTTP response has no language redirect or `Location` header.

Production emits browser directories for `sv` and `fi`, localized server applications, and the shared `server.mjs` entry. The technical source locale `aa` is not emitted. The existing SEO contract is preserved: canonical and `x-default` URLs use the configured default language (Swedish here), alternate links include Swedish and Finnish, and `og:url` uses the active locale. Forwarded HTTPS produces HTTPS URLs. Browser bootstrap normalizes an unprefixed address to its Swedish-prefixed route while retaining the query string; this is separate from HTTP language negotiation.

Verification completed:

- `npm run build:ssr`, `npm run test:build-output`, all 267 Jasmine/Karma tests, and all 17 focused emitted-server checks pass. The latter also cover configurable locale subpaths, single-locale fallback, disabled localization, deployment base paths, and static mounts.
- All 32 existing SSR smoke cases pass against the local Node server, the production Docker image directly, and Docker Compose/nginx.
- An additional temporary matrix passes in each of those three environments: 16 HTML cases cover root, nested lazy article, collection introduction, person index, and missing/404 routes with `/sv`, `/fi`, and no prefix, plus an escaped query string. Checks include status, HTML language, base href, canonical/Open Graph/alternate links, opposing language preferences, and absence of redirects.
- A separate 15-case static matrix passes in each environment: `robots.txt`, `sitemap.txt`, favicon, Ionicons SVG, and emitted JavaScript with both locale prefixes and no prefix. Responses have the expected MIME types, nonempty bodies, and no redirect or SSR rate-limit headers.
- The actual Dockerfile builds and starts with production-only dependencies. Two forwarded-HTTPS cases pass through nginx, and both locale JavaScript bundles are served compressed with immutable caching.
- Desktop and mobile-width browser checks confirm Swedish/Finnish language switching, lazy-route direct navigation and refresh, preserved locale during history navigation, index filters, collection text rendering, Swedish search results, media thumbnails/image-viewer controls, and the Finnish 404 page. Ebook navigation retains the Swedish prefix and localized download UI; native PDF rendering was not verified in the in-app browser.

These checks use the default auth-disabled configuration; the phase 9 auth-rendering checkpoint remains applicable. The broader development-server/HMR and CI audit remains phase 12.

---

## 12. Validate development-server, output, Docker, nginx, and CI behavior

The application builder uses Angular's modern esbuild/Vite development pipeline.

### Development server

Verify:

~~~powershell
npm start
npm run start:fi
~~~

Test:

- Swedish development server.
- Finnish development server.
- Lazy route loading.
- Global SCSS.
- Component SCSS.
- custom CSS.
- Ionicons SVG assets.
- representative icons registered by `src/ionicons-polyfill.ts`, including direct navigation/SSR followed by client startup.
- source maps.
- file replacements where applicable.
- component/template/style HMR behavior.
- route generation expectations during development.

The reference starter confirms that development SSR can differ from the production locale-prefixed runtime. Do not require production `server.ts` middleware behavior from `ng serve`; validate production server behavior separately through `serve:ssr`.

### Output/deployment

Confirm:

- `npm run compress` still targets the correct browser directory.
- gzip files are produced where nginx expects them.
- Docker copies the complete application-builder output.
- Docker starts through `npm run serve:ssr`.
- nginx volume still points to the correct browser output directory.
- `nginx.conf` still serves hashed JS/CSS/fonts, locale assets, `static-html`, and root robots/sitemap fallback.
- GitHub Actions requires no unexpected builder-specific changes.
- `npm ci --omit=dev` is sufficient for the emitted production server runtime.

Verify:

- Pre-Vitest fast gate.
- Full SSR gate.
- Container gate.
- Docker Compose + nginx.
- SSR smoke through nginx.
- Forwarded HTTPS headers.
- Rate limiting.
- Static caching.
- gzip-static delivery.

Possible commits, only when changes are needed:

~~~text
fix(dev): align development server with application builder
build(docker): align deployment with application builder
~~~

Keep development and deployment fixes separate when practical.

### Phase 12 implementation checkpoint — 2026-10-06

This checkpoint reuses phase 11's production build, emitted-output checks, 267 Jasmine/Karma tests, focused server checks, Docker build with production-only dependencies, full SSR/locale matrices, forwarded HTTPS, and gzip JavaScript results. Application sources, dependency versions, Dockerfile, and production build commands are unchanged, so those suites and the Docker build were not repeated.

Two gaps required fixes:

- Both npm start commands now run route generation through `prestart`/`prestart:fi`. Development SSR imports the ignored server-route artifact even though its browser router uses canonical routes. Removing the three generated outputs reproduced a missing-module error; startup now regenerates all three with identical bytes before compiling successfully.
- nginx's immutable cache rule now includes the application builder's locale `media/` directory. Previously a hashed font returned HTTP 200 without `Cache-Control`; it now receives the same one-year immutable policy as hashed JS/CSS. The existing one-day asset/static-menu policy is retained.

Additional verification completed:

- Both locale development servers render backend content with the correct HTML language and `/` base href. Lazy index/article routes render and refresh successfully; representative registered Ionicons retain their SVGs after browser startup.
- Reversible source probes verify global SCSS, custom SCSS, component SCSS, template, and TypeScript updates. Global style and template HMR preserve a typed index search term; component styles receive component updates. Custom SCSS edits trigger a full reload because the file is also copied as an asset, and TypeScript changes trigger a full reload. All five probe sources were restored byte-for-byte.
- Development JavaScript/SCSS maps contain source content, and the browser map identifies canonical `app.routes.ts`. The retained production server contains the enabled production-environment replacement.
- Eleven additional HTTP probes pass through nginx using the retained phase 11 image: Swedish/Finnish CSS, hashed fonts, and generated collection menus have correct MIME/cache policies; CSS/menus use gzip-static. A temporary two-request SSR quota produces `200`, `200`, `429`, while fonts/menus remain available after quota exhaustion. `nginx -t` passes before reloading the test configuration.
- The GitHub Actions workflow still builds the same Dockerfile with Buildx and `NODE_IMAGE_TAG=24-alpine`; it has no legacy builder/output/runtime references requiring changes. This was a configuration audit; no workflow was triggered or image published.
- TypeScript checking and source encoding (351 files) pass after source restoration and route regeneration.

Development SSR/HMR and route-generation expectations are documented in `README.md` and `docs/DEVELOPMENT.md`; deployment caching is documented in `docs/DEPLOYMENT.md`. No additional application-builder deployment changes are required before the Vitest rehearsal.

---

# Vitest migration

The Vitest migration happens only after the application builder is stable. Angular's Vitest unit-test builder requires the application build system.

The reference starter is the target infrastructure model:

~~~json
"test": {
  "builder": "@angular/build:unit-test"
}
~~~

with:

- `vitest`,
- `jsdom`,
- `vitest/globals` in `tsconfig.spec.json`,
- no `karma.conf.js`,
- no `src/test.ts` manual TestBed initialization.

The default execution environment should be Node + `jsdom`.

---

## 13. Rehearse the Jasmine/Karma -> Vitest conversion

Before changing the main branch, rehearse the conversion in a disposable branch/worktree.

### 13.1 Inventory the current Jasmine-specific patterns

The current suite contains several patterns that require explicit review:

- `jasmine.SpyObj`,
- `jasmine.createSpyObj`,
- `jasmine.createSpy`,
- `spyOn`,
- `spyOnProperty`,
- `jasmine.any`,
- `jasmine.objectContaining`,
- `.and.returnValue(...)`,
- `.and.resolveTo(...)`,
- `.and.callFake(...)`,
- `.calls.reset()`,
- `.calls.mostRecent().args`,
- `jasmine.clock()` timer control.

Stage 1 already removed Angular `fakeAsync`/`tick` usage, which reduces Vitest migration risk.

### 13.2 Run Angular's migration schematic as a preview

After the application builder is active in the worktree:

1. install `vitest` and `jsdom`,
2. temporarily configure the worktree's test target with `@angular/build:unit-test` and Vitest,
3. update the worktree's `tsconfig.spec.json` to expose Vitest globals,
4. then run:

~~~powershell
ng g @schematics/angular:refactor-jasmine-vitest --project app
~~~

Treat the schematic as a refactoring assistant, not authoritative output. Angular currently documents this migration tooling as requiring manual review.

Inspect every TODO produced by the schematic.

### 13.3 Compare with the reference starter

Compare:

- `angular.json` test target,
- `tsconfig.spec.json`,
- package dependencies,
- absence of manual TestBed bootstrap,
- default `jsdom` environment.

Do not copy the starter's single test style mechanically where this repository's tests need richer fakes or HTTP testing.

### 13.4 Decide global setup

The current `src/test.ts` performs two jobs:

1. imports `ionicons-polyfill.ts`,
2. manually initializes Angular TestBed.

The `@angular/build:unit-test` builder initializes Angular TestBed automatically, so the manual TestBed initialization must go away. The Ionicons registration must **not** go away.

Because `ionicons-polyfill.ts` remains an application polyfill, first verify that Angular's unit-test builder loads it through the application build configuration. If it does, no additional Ionicons import is needed. A setup file can still be required for test cleanup, as verified in the rehearsal below.

If the unit-test builder does not load that application polyfill in this configuration, use the test target's `setupFiles` option and a minimal setup file that imports `src/ionicons-polyfill.ts` exactly once. Do not duplicate the icon list or reintroduce component-local `addIcons()` calls.

Do not manually call `getTestBed().initTestEnvironment(...)` under the new builder.

Commit:

- No production commit.
- If the migration plan needs changes:

~~~text
docs(migration): refine Vitest conversion plan
~~~

### Phase 13 rehearsal checkpoint (2026-10-06)

The conversion was rehearsed from `546443b` in an isolated worktree using Angular CLI/build/schematics 22.2.1, Vitest 5.0.3, jsdom 30.1.2, Node 24.20.0, and npm 11.19.0. Angular's current migration guidance was reviewed again; the installed builder accepts Vitest 4 or 5. The reference starter's current `main` remains the recorded `d012cb4`; its minimal target, Vitest globals, jsdom environment, and automatic TestBed initialization remain the infrastructure model. Its older Vitest 4/jsdom 28 versions are not required by this project.

The baseline passes all **267 Jasmine/Karma tests across 44 spec files**, with no skipped or focused tests. The inventory includes 49 `SpyObj` annotations, 60 `createSpyObj` calls, 24 standalone `createSpy` calls, 12 method spies, four property spies, five clock install/uninstall pairs, 17 clock advances, and four `clock().withMock()` blocks. It also covers call-history inspection/reset, sequential return values, asymmetric matchers, and assertion context messages. There are no Angular `fakeAsync`, `tick`, or `waitForAsync` wrappers.

After installing the rehearsal dependencies, selecting `@angular/build:unit-test`, retaining extended diagnostics, exposing Vitest globals, and generating routes, the schematic was run with:

~~~powershell
ng g @schematics/angular:refactor-jasmine-vitest --project app --verbose
~~~

It scanned 44 files, transformed 42, and left the two already compatible files unchanged. Its report contains four TODOs, all for `AuthService`'s `clock().withMock()` blocks. Review must also cover problems that receive no TODO: the first compile reported 55 errors, and the first runnable conversion passed 255 tests with 12 failures. The schematic also reprints converted files with four-space indentation and mixed quote styles; retain the repository's two-space style and existing formatting when applying the final conversion.

The following manual changes were verified in the rehearsal and belong in phase 15:

| Area | Required conversion |
| --- | --- |
| Typed service fakes | Narrow `MockedObject` to the methods actually provided, using `MockedObject<Pick<Service, 'method'>>`. Preserve real Angular signal properties separately with `Pick<Service, 'signal'>`; signals are callable but are not Vitest mocks. Do not cast incomplete fakes to full service types. |
| Timer blocks | Replace the four `clock().withMock()` blocks with `vi.useFakeTimers()` and `try/finally` cleanup. Keep the existing loading-bar deadlines and cancellation assertions; advance Angular's newly scheduled rendering asynchronously before `fixture.whenStable()`. |
| Spy cleanup | Use a minimal `src/test-setup.ts` registered through `setupFiles` to restore method/property spies and real timers after each test. Include that file in `tsconfig.spec.json`. Storage-spec cleanup must restore its throwing spy before clearing storage. |
| Mid-test call-through | The schematic turns `removeItemSpy.and.callThrough()` into a bare `removeItemSpy;` expression after an earlier throwing implementation. Replace that expression with `mockRestore()` so the original storage method runs again. |
| Request locale | Provide `LOCALE_ID: 'en'` explicitly in `AuthService` tests that assert English request payloads. The new runner inherits the workspace's technical source locale `aa`; do not change application i18n configuration or silently change the payload assertions. |
| Route recognition | Compare the recognized component with the imported component class, preserving every URL, parameter, parent-route, data, and guard assertion. esbuild can rename constructors (for example `_HomePage`), so `.name` is not a stable identity assertion. |
| Timer handles | Preserve the retry-cancellation assertion without requiring a numeric handle: Node fake timers return an object whereas Chrome returns a number. |
| Strict TypeScript | Handle the possibly absent `mock.lastCall` explicitly, and replace the unsupported `vi.spyOn<any>` conversion with a narrow typed view of the private method. |

The verified setup file contains only runner cleanup:

~~~typescript
// Restore method/property spies between tests, matching Jasmine's automatic cleanup.
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
~~~

It does not initialize TestBed or import Ionicons. A temporary two-test environment probe verifies both the absence of Zone.js and inherited localization/centralized registration of `filter-outline`, `language-sharp`, and `refresh`. `npm test` watch mode passes the probe initially and reruns it after a source edit. The probe is then removed, preserving the suite's original test count. No real-browser provider, Zone.js compatibility layer, custom Vitest configuration, or global DOM API shims are needed for the existing suite.

The completed rehearsal passes all **267 tests in the same 44 files**, with no skipped tests. All 254 source-level test declarations remain (parameterized declarations expand to 267 executed tests). The schematic splits 18 `toHaveBeenCalledOnceWith` assertions into count and argument checks, accounting for the increase from 682 to 700 source-level `expect` calls. Successful Vitest JSON runs span approximately 10–17 seconds after 10–11-second bundle builds; Karma reports approximately 1.5 seconds of Chrome execution, excluding its Webpack build. These are different timing scopes; measure comparable command durations in the later benchmark checkpoint.

Logs, API inventories, the original schematic patch, and the verified conversion are retained locally for the final cutover. The active checkout still uses Jasmine/Karma: no application sources, test APIs, dependencies, lockfile, or runner configuration are changed by phase 13.

---

## 14. Add Vitest dependencies without changing the runner

Install the dependencies needed by the target test setup while Jasmine/Karma still remains active:

~~~powershell
npm install --save-dev vitest jsdom
~~~

Do not remove Karma/Jasmine yet.

Update `allowScripts` only if npm reports a newly required reviewed lifecycle-script approval.

Verify:

- Existing Jasmine/Karma `npm run test:ci` still passes.
- Pre-Vitest fast gate.
- Clean `npm ci` from the updated lockfile.

Commit:

~~~text
test: add Vitest migration dependencies
~~~

This gives a small reversible checkpoint before the test-runner cutover.

### Phase 14 dependency checkpoint (2026-10-06)

Added `vitest: ^5.0.3` and `jsdom: ^30.1.2` as development dependencies, matching the versions verified in phase 13. Their Node requirements are compatible with the repository's declared Node 24.15 minimum. The updated lockfile adds 44 development-only package entries without changing existing package versions or removing entries. None of the new entries requires a lifecycle script, so `allowScripts` is unchanged.

The active test target remains `@angular-devkit/build-angular:karma`. Jasmine types, manual TestBed bootstrap, Karma configuration/plugins, npm test commands, and all test files are unchanged.

Verification after the updated lockfile's clean `npm ci`:

- Dependency installation succeeds with Node 24.20.0 and npm 11.19.0; the installed versions are Vitest 5.0.3 and jsdom 30.1.2.
- All 267 Jasmine/Karma tests across the existing 44 spec files pass.
- The pre-Vitest fast gate passes: source encoding (351 files), all 24 route-parser checks, route generation, and the `development,sv` browser/server build. No Angular prerender routes are introduced.

The dependencies are ready for phase 15's atomic test-runner and test-API cutover.

---

## 15. Atomic cutover from Jasmine/Karma to Vitest

This is the second deliberately atomic migration commit.

All test files must compile and pass under Vitest before this commit is created.

### 15.1 Switch the Angular test target

Follow the reference starter:

~~~json
"test": {
  "builder": "@angular/build:unit-test",
  "options": {
    "setupFiles": ["src/test-setup.ts"]
  }
}
~~~

Use the minimal target plus the runner-cleanup setup verified in phase 13. The builder defaults to the project's development build configuration and `tsconfig.spec.json`; application polyfills supply Ionicons and localization without another setup import.

If repository-specific options are required, add them explicitly rather than copying legacy Karma options.

The new test builder does **not** accept the old Karma target's duplicated `assets`/`styles` options. Tests should inherit application styles/assets from the application build target.

Remove:

- `main: "src/test.ts"`,
- `karmaConfig`,
- Karma-only CI target options that are no longer needed.

Keep the npm command surface:

- `npm test` -> watch mode in an interactive terminal,
- `npm run test:ci` -> one non-watch run.

### 15.2 Update TypeScript test types

Match the reference starter's direction:

~~~json
"types": [
  "vitest/globals",
  "@angular/localize"
]
~~~

Remove Jasmine types.

Retain this repository's extended Angular diagnostics.

### 15.3 Remove manual test bootstrap

Delete `src/test.ts` only after confirming that `src/ionicons-polyfill.ts` is loaded either through inherited application polyfills or a minimal `setupFiles` entry.

Do not delete `src/ionicons-polyfill.ts`. Angular's unit-test builder owns TestBed initialization, while the repository's polyfill continues to own centralized Ionicons registration.

### 15.4 Convert the test APIs

Run the Angular schematic, then manually complete all unsupported conversions.

Typical mappings:

- `jasmine.createSpy(...)` -> `vi.fn()`
- `jasmine.createSpyObj(...)` -> typed objects composed from `vi.fn()`, or deliberate `vi.mocked`/`vi.spyOn` usage where appropriate
- `spyOn(obj, method)` -> `vi.spyOn(obj, method)`
- `spyOnProperty(obj, prop, 'get')` -> `vi.spyOn(obj, prop, 'get')`
- `jasmine.any(Type)` -> `expect.any(Type)`
- `jasmine.objectContaining(...)` -> `expect.objectContaining(...)`
- `.and.returnValue(...)` -> `.mockReturnValue(...)`
- `.and.returnValues(...)` -> a finite `.mockReturnValueOnce(...)` sequence; when replacing setup responses before any calls, use `.mockReset()` first to clear earlier defaults and queued values. Preserve call history if an override occurs mid-test.
- `.and.resolveTo(...)` -> `.mockResolvedValue(...)`
- `.and.callFake(...)` -> `.mockImplementation(...)`
- `.calls.reset()` -> `.mockClear()` to preserve the configured implementation; use `.mockReset()` only when intentionally resetting that implementation too
- `.calls.mostRecent().args` -> inspect `mock.calls`
- `jasmine.clock().install()` -> `vi.useFakeTimers()`
- `jasmine.clock().tick(ms)` -> `vi.advanceTimersByTime(ms)` or `await vi.advanceTimersByTimeAsync(ms)`
- `jasmine.clock().uninstall()` -> `vi.useRealTimers()`
- `jasmine.clock().withMock(...)` -> a fake-timer block with guaranteed real-timer cleanup

For timer-heavy specs:

- always restore real timers in `afterEach`,
- use async timer advancement when queued promises/microtasks participate,
- keep `fixture.whenStable()` assertions where they verify zoneless scheduling.

Do not replace meaningful typed fakes with broad `any` casts just to make Vitest compile.

### 15.5 Remove Karma/Jasmine dependencies and configuration

Remove when no longer referenced:

- `karma`,
- `karma-chrome-launcher`,
- `karma-coverage`,
- `karma-jasmine`,
- `karma-jasmine-html-reporter`,
- `jasmine-core`,
- `@types/jasmine`,
- `karma.conf.js`.

The old `ChromeHeadlessNoGpu` workaround disappears because the default Vitest environment is `jsdom`.

Do not add a real-browser provider merely to reproduce the old Chrome runner. The manual browser/SSR gates cover integration behavior; add Vitest browser mode only for a demonstrated test requirement.

### 15.6 Check jsdom-specific compatibility

Pay attention to tests or components that touch browser APIs not fully implemented by `jsdom`, including:

- scrolling/layout measurements,
- `matchMedia`,
- observers,
- object URLs,
- navigation/location APIs,
- custom elements and Ionic interactions.

Prefer narrow deterministic mocks in a test setup file over broad global browser emulation.

The reference starter demonstrates that an Ionic app shell can be tested under the default `jsdom` setup, but this repository's richer components still need explicit verification.

### Vitest cutover verification

Run:

~~~powershell
npm run test:ci
npm test
~~~

Also run the post-Vitest fast gate.

Compare with the recorded Jasmine/Karma test-runner parity data.

Audit:

~~~powershell
rg "jasmine\.|jasmine:|karma|ChromeHeadless|spyOnProperty\(|\bspyOn\(" src angular.json package.json tsconfig.spec.json
~~~

The intended result is no legacy test-framework usage, except historical migration documentation.

Also verify:

~~~powershell
npm ls karma jasmine-core @types/jasmine
~~~

The intended result is that these are not direct project dependencies.

Commit:

~~~text
test: migrate unit tests from Jasmine Karma to Vitest
~~~

Do not commit a partially converted suite.

---

### Phase 15 Vitest cutover checkpoint (2026-10-07)

Completed the atomic runner/API cutover from `27392fa` with the versions verified in phases 13–14: Angular CLI/build/schematics 22.2.1, Vitest 5.0.3, jsdom 30.1.2, Node 24.20.0, and npm 11.19.0. [Angular's current migration guidance](https://angular.dev/guide/testing/migrating-to-vitest) and the installed unit-test builder schema were reviewed again.

The test target now uses `@angular/build:unit-test` with only `setupFiles: ["src/test-setup.ts"]`. It inherits development styles, assets, localization, and the centralized Ionicons polyfill. Angular owns TestBed initialization; the setup only restores spies and real timers. `tsconfig.spec.json` supplies Vitest globals and includes the setup, while `tsconfig.app.json` excludes it so test globals cannot enter the application compilation. Both configs retain extended diagnostics. The npm test commands are unchanged.

Ran the installed `refactor-jasmine-vitest` schematic, then applied the manual fixes verified in phase 13: narrow typed method fakes with separate real signal properties, guaranteed fake-timer cleanup, zoneless rendering advancement, storage-spy restoration, explicit English request locale, component-class route assertions, cancellable Node timer handles, and strict last-call/private-method typing. Existing two-space indentation, quote style, and unrelated formatting are preserved.

The final review also retains types previously inferred from generic `createSpyObj` factories, including local constants and provider fakes. The six `returnValues` conversions reset earlier queued/default responses before configuring finite one-time values. All six occur before the fake is called, so resetting call history loses no assertions; ordinary call-history resets use `mockClear()` and retain their implementation.

Removed `src/test.ts`, `karma.conf.js`, and the seven direct Jasmine/Karma dependencies. The lockfile removes 98 package entries without adding entries or changing retained package versions; `allowScripts` is unchanged. `@angular-devkit/build-angular` and the remaining legacy dependency cleanup stay in phase 16.

Verification:

- `npm run test:ci` passes **267 tests across all 44 spec files**, matching the recorded Jasmine/Karma baseline, with no skipped or focused tests.
- All 254 source-level test declarations and their descriptions remain. Full assertion chains match the verified rehearsal; 682 original `expect` calls become 700 because 18 once-with-arguments assertions now explicitly check both count and arguments.
- Interactive `npm test` watch mode passes a temporary environment probe and reruns it after an edit. The probe confirms no Zone.js, inherited `$localize`, and the centralized `filter-outline`, `language-sharp`, and `refresh` registrations. It is removed after verification, restoring the original suite count.
- The post-Vitest fast gate passes: source encoding (351 files), all 24 route-parser checks, route generation, and the `development,sv` browser/server build. The build emits no prerender routes.
- The legacy API/config audit is clean. `npm ls karma jasmine-core @types/jasmine` reports an empty dependency tree.

No browser provider, Zone.js compatibility layer, custom Vitest configuration, or global DOM shims are needed. Developer/repository guidance and the changelog now describe the active Vitest workflow. Unrelated production SSR, Docker, nginx, and localization integration checks are retained from the previous checkpoints rather than repeated for this test-tooling change.

---

## 16. Remove legacy split-builder and build-angular artifacts

After both application and test migrations are stable, remove the old compatibility layer.

Candidates:

- `proxy-server.js`,
- `postbuild-copy-files.js`,
- `tsconfig.server.json`,
- old `CommonEngine`-specific comments,
- old Webpack-specific main-module comments,
- obsolete `auth-protected-route-paths.generated.ts` if generated server routes fully replace it,
- `src/express.tokens.ts` if nothing still consumes it,
- `@angular-devkit/build-angular` if no target/config/package still requires it.

Before removing `@angular-devkit/build-angular`, verify:

- application build uses `@angular/build:application`,
- dev server uses `@angular/build:dev-server`,
- test target uses `@angular/build:unit-test`,
- i18n extraction delegates to `@angular/build:extract-i18n`,
- no package/plugin configuration references the old devkit builder.

Update:

- `.gitignore` generated artifact list,
- route-generator tests,
- hard-coded output paths in scripts,
- comments referring to separate browser/server builder targets.

Audit:

~~~powershell
rg "CommonEngine|proxy-server|postbuild-copy-files|tsconfig.server|auth-protected-route-paths|__non_webpack_require__|browserTarget|serverTarget|@angular-devkit/build-angular|karma|jasmine" .
~~~

Review historical migration-plan matches separately; they do not need to be erased.

Verify:

- Post-Vitest fast gate.
- Full SSR gate.
- `npm run extract-i18n`.
- `npm ci` from a clean dependency tree.

Commit:

~~~text
build: remove legacy Webpack and Karma tooling
~~~

---


### Phase 16 legacy tooling cleanup checkpoint (2026-10-07)

Completed the cleanup from `0931896` after the merged Vitest cutover. [Angular's current build-system migration guidance](https://angular.dev/tools/cli/build-system-migration) and the installed package/configuration were reviewed again. Application builds, development serving, unit tests, and i18n extraction all use `@angular/build`; the extraction merge wrapper has no dependency on the retired builder.

Removed the direct `@angular-devkit/build-angular`, `browser-sync`, and `istanbul-lib-instrument` dependencies. Browser Sync was only used by the old builder, and the old coverage dependency is unused by the Vitest suite. The lockfile removes 458 package entries without adding entries or changing retained package versions. npm scripts and `allowScripts` are unchanged. A clean `npm ci` installs 380 packages with Angular 22.2.1, Vitest 5.0.3, and jsdom 30.1.2 on Node 24.20.0/npm 11.19.0.

Route generation now writes only `app.routes.generated.ts` and `app.routes.server.generated.ts`. Removed the obsolete auth-protected-path writer and generated file, updated ignore rules, and adjusted the generation assertions while retaining the full auth/feature/render-mode matrix. The shared protected-route parser remains because sitemap generation reads the canonical route source through it. Existing fork checkouts can delete any stale `src/app/auth-protected-route-paths.generated.ts` copy once; generation no longer recreates it.

The old launcher, copy script, server TypeScript config, Express tokens, and runtime Webpack/CommonEngine assumptions were already removed in earlier phases. The active-source/configuration audit is clean. `npm ls` confirms that the old builder, Browser Sync, Istanbul instrumenter, Webpack, Karma, and Jasmine are absent. The lockfile retains only upstream optional-peer declarations for Karma and the Istanbul instrumenter; these do not install either package.

Verification:

- Clean `npm ci` succeeds with the updated lockfile.
- The post-Vitest fast gate passes: source encoding (350 files), all 24 route-parser checks, route generation, all 267 unit tests across 44 spec files, and the `development,sv` browser/server build.
- `npm run extract-i18n` succeeds. All four catalogs retain their units and translations; extraction's line-ending-only changes were restored so the catalog bytes are unchanged.
- `npm run build:ssr` succeeds with Swedish/Finnish output and no prerender routes. `npm run test:build-output` verifies both locale directories and `dist/app/server/server.mjs`.
- `npm run serve:ssr` starts the built production app, and all 32 SSR smoke tests pass, including Swedish home/introduction/persons, Finnish routes, SEO/proxy origins, unprefixed default-language serving, mobile/desktop markup, and expected 404 responses. The test server is stopped afterward.

No runtime, locale, output-path, or deployment configuration changes are required. Docker/nginx behavior retains the earlier phase 11–12 checkpoints; this cleanup does not repeat those container/browser tests.

---

## 17. Optional: move true static assets to `public/`

This checkpoint is optional because it is not required by the application builder or Vitest and has high downstream merge-conflict cost. The project owner approved it after phase 16 and expanded its scope to clarify the files that forks customize: group configuration and global style overrides under `src/project/`, rename the application-wide stylesheet to `styles.scss`, and move public documents and generated static HTML with the other public assets.

Do this only after:

- application-builder SSR is stable,
- localization behavior is stable,
- Docker/nginx behavior is stable,
- Vitest migration is complete.

Configuration and styles remain source/build inputs under `src/`; they are compiled rather than copied as raw public files. Approved moves:

~~~text
src/assets/fonts/   -> public/assets/fonts/
src/assets/images/  -> public/assets/images/
src/assets/ebooks/  -> public/assets/ebooks/
src/assets/files/   -> public/assets/files/
src/assets/icon/favicon.ico -> public/favicon.ico
src/assets/config/config.ts -> src/project/config.ts
src/assets/custom_css/custom.scss -> src/project/global-overrides.scss
src/global.scss -> src/styles.scss
src/robots.txt -> public/robots.txt
src/sitemap.txt -> public/sitemap.txt
src/static-html/ -> public/static-html/
~~~

Implement in three separately verified steps:

1. Relocate project configuration and global style overrides, rename the application stylesheet, and update aliases, imports, prebuild configuration paths, style entries, and documentation. Preserve stylesheet order and all fork settings.
2. Move static assets, update Sass font source paths, and copy `public/` through Angular's asset rule. Link to `favicon.ico` while retaining the previous `assets/icon/favicon.ico` address as an alias of the same file.
3. Move robots, sitemap, and static HTML; update generator destinations and generated-menu ignores. Verify default-language root document serving through Express and nginx.

Rules:

- Keep public request URLs unchanged.
- Make only path/location changes and the minimum required build/script references.
- Do not refactor asset consumers as part of these moves.
- Do not rename assets while moving them.
- Avoid unrelated reformatting of `angular.json` or generator scripts.
- Keep generated public file changes separate from the bulk static-asset move during implementation and validation.
- Review the diff from a fork-sync perspective: it should be easy to resolve when a fork has extra or replaced assets.
- Leave changes uncommitted for the project owner to review, commit, and submit as a PR, as requested.

Verification after each move:

- Post-Vitest fast gate.
- sitemap/static-menu generation.
- development server.
- full SSR gate.
- manual image/font/icon/file checks.
- Docker/nginx container gate.

The file moves and renames are documented in the [v4 breaking changes and fork migration notes](../../../breaking-changes/v4.md#1-relocate-configuration-styles-and-public-files). The [project customization guide](../../../PROJECT-CUSTOMIZATION.md#project-customization-files) describes the customization entry points.

### Phase 17 implementation checkpoint (2026-10-07)

Started from the merged phase 16 baseline `1fe50d2` on the owner's `refactor-move-assets-and-configuration-files` branch. Implemented the three steps above without commits. The `@config` alias and exported settings are unchanged. Application-wide styles load before project overrides; the shared TEI inclusion files remain under `src/theme/`. Public asset URLs and the `dist/app/browser/<locale>` contract are preserved.

Angular now copies `public/` plus the favicon alias and the existing Ionicons SVG rule. Sass references the relocated font files and still emits hashed resources under `media/`. Project TypeScript/SCSS are no longer copied into public output. Sitemap and static-menu generators retain their flags and behavior while writing into `public/`; ignored generated collection menus can be carried over or regenerated. Docker still runs both generators before the production build and compression.

Verification is performed at each move boundary. The final unit suite passes all 267 tests across 44 files; route-parser checks pass 24 cases, source encoding checks cover 350 files, and static-menu fixture checks pass. Real generator runs produce 4,450 sitemap URLs and 46 menus in two languages with 11,602 links. The tracked sitemap placeholder is restored after this verification so the diff remains a file move rather than a backend-content refresh.

Development SSR and stylesheet HMR from `src/project/global-overrides.scss` are verified with a headless browser, including loaded repository images, fonts, Ionicons, root crawler documents, and both favicon URLs. The API home-page content also references a UNESCO logo that was already absent from the repository; this unrelated missing-content reference is unchanged.

Production builds preserve Swedish/Finnish locale directories, the canonical server entry, zero prerendered routes, and the configured default language. The build-output check verifies crawler documents and both favicon paths against their public sources, and rejects raw project source in output. All 17 emitted-server checks pass, including single-locale and nested-base-path static routing.

The production Docker image runs sitemap/menu generation, the integrated build, and compression successfully. All 32 SSR smoke tests pass through nginx. Byte checks verify 356 copied files across both locales and 288 static HTTP responses through Node and nginx. Production browser checks at `/`, `/sv/`, and `/fi/` verify repository images and fonts. All 456 gzip sidecars decompress to their originals; nginx serves compressed CSS, keeps WOFF/WOFF2 uncompressed, and preserves root-document, unversioned-asset, and immutable hashed-font cache policies. Temporary servers, containers, and test volumes are stopped/removed after verification; local evidence helpers remain ignored under `tmp/stage-2-phase-17/`.

---

## 18. Re-run the complete route/configuration/test matrix

Before documentation cleanup, run the complete migration matrix.

### Route generation

Verify:

- `featureBasedRoutes: false`.
- `featureBasedRoutes: true`.
- Generated browser routes.
- Generated server routes.
- Unknown top-level route handling.
- Wildcard route preservation.

### Authentication

Verify:

- auth disabled.
- auth enabled.
- auth-only routes.
- protected collection routes.
- account route.
- search/index/media protected routes.
- auth-protected server routes use CSR.
- public server routes use SSR.

### SSR/runtime

Verify:

- public SSR initial HTML.
- CSR shell for protected routes.
- configured allowed host.
- invalid host behavior.
- proxy trust.
- forwarded HTTPS.
- canonical/Open Graph URLs.
- user-agent mobile/desktop parity.
- rate limiting.
- missing static files.
- `/static-html`.

### Localization

Verify:

- Swedish.
- Finnish.
- default Swedish language behavior.
- locale-prefixed direct navigation.
- unprefixed navigation.
- hreflang links.
- localized assets.
- `npm run extract-i18n`.

### Unit tests

Verify:

- `npm run test:ci` under Vitest.
- `npm test` watch mode.
- timer-heavy tests do not leak fake timers.
- mocks/spies are restored between tests.
- no test depends on Chrome-specific ordering or layout by accident.
- optional `ng test --watch=false --coverage` works if coverage is used by maintainers.

### Browser behavior

Run the full manual browser gate.

If fixes are required, commit them by subsystem rather than as one miscellaneous migration commit.

Example commits:

~~~text
fix(ssr): preserve proxy origin handling
fix(auth): align client render modes with generated routes
fix(i18n): preserve default-language routing
test(auth): stabilize Vitest auth specs
test(ui): stabilize Vitest DOM mocks
~~~

---

### Phase 18 verification checkpoint (2026-10-07)

Validated the merged phase 17 and upgrade-guide baseline `ec33708`. Rechecked Angular's [SSR rendering-mode guidance](https://angular.dev/best-practices/performance/ssr) and [Vitest/jsdom testing guidance](https://angular.dev/guide/testing). No application or test-suite fixes were required.

Built and ran all four production configuration combinations using the actual canonical route source and relocated project configuration:

| `featureBasedRoutes` | Auth enabled | Generated browser routes | Client-rendering entries | Additional HTTP checks | SSR smoke checks |
| --- | --- | --- | --- | --- | --- |
| `true` | `false` | 14 | 0 | 58 | 32 |
| `true` | `true` | 21 | 18 | 58 | 32 |
| `false` | `true` | 26 | 18 | 58 | 32 |
| `false` | `false` | 26 | 0 | 58 | 32 |

Generation is reproducible in each combination. Browser/server metadata stays aligned, unknown fork routes are retained, the final wildcard is preserved, and no prerender mode is emitted. The 18 CSR entries cover 16 protected top-level paths plus descendants of the two lazy protected routes. HTTP checks cover those paths in Swedish, Finnish, and without a locale prefix, including account, auth-only pages, collection pages, search, index, and media. Public pages remain SSR; protected pages return empty CSR shells when auth is enabled; auth-only pages return application 404s when auth is disabled. Invalid hosts receive HTTP 400 without an Angular document. Each build passes the emitted-output check and produces zero prerendered routes.

Verification also passes:

- All 267 Vitest tests across 44 files, 24 route-parser/generator checks, source encoding for 350 files, and static-menu generator fixtures.
- All five smoke-runner checks and four benchmark-launch/cleanup checks. The latter validate tooling behavior; the performance comparison remains phase 19.
- All 17 emitted-server middleware checks: configured/single/nested locale paths, static/probe short-circuits, missing assets and `/static-html`, caching, rate limiting, ebook exceptions, proxy trust, and spoofed-header rejection. The four smoke suites also cover forwarded HTTPS, canonical/Open Graph URLs, hreflang, and mobile/desktop SSR output.
- A further 16 locale/SEO cases and 15 static HTTP cases against the final default production runtime, including opposing language preferences, escaped queries, MIME types, and absence of redirects or static-response limiter headers.
- `npm run extract-i18n` succeeds with all four XLF files unchanged; extraction-only line-ending changes are restored to the repository convention.
- Interactive `npm test` watch mode reruns after an edit and after restoration. A temporary two-test probe proves that the shared setup restores spies and real timers between tests; the probe is removed afterward. Coverage remains optional and is not enabled by the repository's maintained commands, so no coverage dependency or configuration is added.

The production browser gate passes 36 interaction scenarios in Chrome at desktop and mobile sizes across both locales. It covers startup/assets/Ionicons, idle route preloading, side menus, client navigation and the loading bar, direct lazy routes and refresh, collection navigation and added text views, settings/reference overlays, index filters, Ionic outlet history, search, media image viewers, ebook download options, and language switching. Representative desktop/mobile screenshots are reviewed. Four additional browser checks cover unprefixed home and lazy-route startup/refresh: HTTP returns the default-language page without a redirect; browser bootstrap then normalizes the address to the Swedish `/sv/` base href, which is also present in the retained Stage 2 baseline.

Fourteen auth browser scenarios pass in Swedish and Finnish, covering protected-content redirects, invalid-login feedback and return intent, login/account/session restoration/logout, registration, password recovery/reset, JWT-link guards, and email verification. Auth/session endpoints are intercepted with browser-owned fixtures; no real account, credentials, or email delivery is used. Real backend authentication integration remains a fork deployment check.

Existing behavior observed during the browser gate is retained: index filters reset when returning from another page, while Ionic reuses the cached page element. The same reset logic is present in v3.1.1. The already documented missing UNESCO logo from API-authored home content is unchanged. Ebook checks cover the viewer's configured title and download links; they do not certify the external PDF provider's embedding behavior.

The phase 17 Docker/nginx/gzip checkpoint remains applicable: deployment files and application source have not changed since that checkpoint, so its expensive build/compression/static-byte checks are not duplicated. The final default production output is restored under `dist/app`; the original config and test file are restored byte-for-byte, route artifacts are regenerated for auth-disabled/unfiltered defaults, and temporary listeners are stopped. Local logs, matrix results, fixture helpers, and screenshots remain ignored under `tmp/stage-2-phase-18/`.

---

## 19. Compare build, test, and runtime performance

Run:

~~~powershell
npm run bench:ssr:build
~~~

Compare with the Stage 2 baseline.

Also record:

- production build duration,
- browser initial bundle size,
- server bundle size,
- cold SSR timings,
- warm SSR timings,
- `npm run test:ci` duration before and after Vitest.

The application builder and Vitest are expected to improve development/test tooling, but Stage 2 should not claim a performance improvement unless measured in this repository.

Keep critical CSS inlining disabled for this comparison so the before/after SSR measurements isolate the builder/runtime migration rather than mixing in a separate rendering optimization. A future critical-CSS experiment should establish its own baseline and compare at least server response/build cost, HTML response size, and browser rendering metrics.

Investigate material regressions before finalizing the migration.

Commit:

- No commit unless a justified optimization or benchmark/test-tool fix is required.

### Phase 19 verification checkpoint (2026-10-07)

Measured the merged phase 18 state `60bf669` against the preserved phase 1 baseline `3f4968b`. Rechecked Angular's [build-system guidance](https://angular.dev/tools/cli/build-system-migration) and [testing guidance](https://angular.dev/guide/testing). The machine, Windows version, Node 24.20.0, npm 11.19.0, Angular/CLI/SSR 22.2.1, Ionic 9.0.6, and TypeScript 6.0.3 match the baseline. Builds, tests, and runtime measurements run sequentially, with existing Angular disk caches retained. Critical CSS inlining remains disabled; hydration, auth, feature filtering, and production locales retain their baseline settings.

| Measurement | Phase 1 baseline | Phase 19 | Change |
| --- | --- | --- | --- |
| CLI-reported production compilation | 49.176 s (browser + server) | 22.307 s (integrated) | −54.6% |
| `npm run bench:ssr:build`, complete command | 75.52 s | 58.23 s | −22.9% |
| `npm run test:ci`, complete command | 82.54 s; 213 tests / 40 files | 43.91 s; 267 tests / 44 files | −46.8% |
| Initial browser JS + CSS, Swedish | 1,328,685 bytes | 1,358,529 bytes | +2.2% |
| Initial browser JS + CSS, Finnish | 1,330,123 bytes | 1,359,967 bytes | +2.2% |
| Complete emitted production server JS, including launcher | 15,790,830 bytes | 8,859,232 bytes | −43.9% |

The current production build takes 38.74 s from command start through the bundle-generation message, including route generation and CLI startup; phase 1 did not separately capture the equivalent build-only wall time. The 58.23 s command measurement includes SSR requests and server cleanup, so it must not be presented as build time alone. The current unit run reports 9.461 s of compilation and 30.32 s in Vitest; runner-only time is not directly comparable with Karma's browser-only time. All 267 tests pass with no skips. These are observed command timings with caches retained, not repeated clean-build distributions or a test-count-normalized comparison.

Browser initial sizes count the stylesheet, entry scripts, and their transitive static imports/module preloads: nine emitted files per locale, compared with four in the Webpack baseline. Counting only the new `main-*.js` would omit shared chunks. The roughly 30 KB raw increase stays below the existing 2 MB warning budget and does not justify a configuration change. Server sizes count all emitted JavaScript for the two production locales and shared runtime, excluding license text, source maps, and the baseline's unused `aa` server output. Comparing the 1.01 MB `server.mjs` alone with a legacy 5.36 MB `main.js` would omit the new runtime's dependencies and localized bundles. Output validation passes for both locales and `dist/app/server/server.mjs`; the build emits zero prerendered routes.

The required benchmark uses the same four routes and five warm requests per route as phase 1. All 24 measured requests return HTTP 200 without transport errors:

| Route | Baseline first request (ms) | Current first request (ms) | Baseline warm average (ms) | Current warm average (ms) |
| --- | --- | --- | --- | --- |
| `/sv/` | 137.74 | 88.92 | 93.93 | 78.66 |
| `/sv/collection/216/introduction` | 1,596.20 | 1,475.96 | 1,965.87 | 1,480.26 |
| `/sv/collection/216/text/20280` | 134.32 | 186.94 | 163.45 | 162.48 |
| `/sv/collection/211/text/20210` | 397.46 | 288.68 | 341.66 | 307.91 |

“First request” is the benchmark's cold measurement: a fresh process has already rendered home for readiness. It is not a process-start or empty-cache measurement. A second fresh-process benchmark produces warm averages of 119.51, 1,951.46, 177.63, and 373.55 ms respectively. This variation prevents a general SSR speedup claim. Requests use the live public API; CPU scheduling, rendering, JIT compilation, garbage collection, and backend responses all affect the result.

Investigated the slower first text request and apparent response-size increase with temporary outgoing-fetch/CPU diagnostics and paired legacy/current runtime runs. The exact retained phase 1 Docker image (`4a4b17b2a458`) supplies the legacy output, verified against its original container inventory. Both runtimes execute sequentially under the same current Windows Node, first legacy/current and then current/legacy. This supplements the original Windows baseline rather than replacing it; the recovered artifact was compiled in Docker. Each run uses the same routes, readiness behavior, and five warm requests. One 86,879-byte HTTP 200 introduction response in the first pair is incomplete and excluded, leaving four valid warm samples for that current introduction average. The reverse-order run checks response completeness and needs no retries.

| Route | Paired legacy warm averages (ms) | Paired current warm averages (ms) |
| --- | --- | --- |
| `/sv/` | 76.74 / 77.84 | 77.12 / 75.02 |
| `/sv/collection/216/introduction` | 1,958.13 / 2,557.54 | 2,294.30 / 2,254.24 |
| `/sv/collection/216/text/20280` | 223.28 / 198.86 | 200.07 / 212.51 |
| `/sv/collection/211/text/20210` | 371.16 / 370.02 | 371.06 / 388.93 |

The baseline's original text benchmark returned about 123 KB, while another retained phase 1 HTTP capture returned 212,952 bytes. The recovered legacy runtime returns 212,736 bytes for that route, close to the current 213,410 bytes; the larger response is therefore not introduced by Stage 2. The diagnostic introduction requests finish their upstream reads within roughly 70–141 ms, while total server responses take about 1.6–2.2 s with comparable CPU time, identifying rendering as the dominant cost in those samples. The legacy runtime exhibits the same slow introduction workload. No consistent material latency regression is found across the original, repeated, and paired measurements; no runtime optimization or benchmark/test-tool change is justified by these results.

Only migration documentation changes. The final default production output remains in `dist/app`; no config or permanent test/source changes are made. Temporary runtime listeners and the Docker export container are stopped/removed. Docker Desktop, started to recover the baseline image, remains available. Full logs, exact request timings/bytes, output inventories, environment details, temporary diagnostics, recovered output, and `comparison.json` remain ignored under `tmp/stage-2-phase-19/`; the original baseline is preserved unchanged.

---

## 20. Update documentation and changelog

Only after the new runtime and Vitest suite are stable, update the main documentation.

### docs/DEVELOPMENT.md

Update the Application architecture section:

- application builder instead of separate Webpack builders,
- `AngularNodeAppEngine` instead of `CommonEngine`,
- integrated browser/server build,
- server route modes,
- auth-protected `RenderMode.Client`,
- public `RenderMode.Server`,
- final output layout,
- `src/server.ts` as the modern server-entry source location,
- public/static asset layout if the optional `public/` checkpoint was completed,
- ESM server entry.

Update Testing:

- Vitest instead of Jasmine/Karma,
- Node + `jsdom` default test environment,
- `npm test` watch behavior,
- `npm run test:ci` single-run behavior,
- any test setup file that remains.

Remove the completed application-builder migration TODO.

Keep the separate hydration TODO.

### AGENTS.md

Update architecture/testing guardrails:

- application builder is now required,
- `AngularNodeAppEngine` is the SSR engine,
- server render modes are generated/config-driven,
- do not reintroduce split legacy builders,
- unit tests use Vitest,
- do not add Jasmine/Karma dependencies,
- hydration remains out of scope unless explicitly requested.

### docs/DEPLOYMENT.md

Update:

- build command description,
- server start path/script,
- output layout if changed,
- Docker/runtime behavior if changed.

### README

Update only if developer setup/build/test commands or output assumptions changed.

### CHANGELOG.md and the v4 fork migration notes

Keep `CHANGELOG.md` as a concise release summary with an explicit breaking-change section and a link to `docs/breaking-changes/v4.md`. Put detailed conflict-resolution instructions, mappings, and the fork validation checklist in those dedicated migration notes. Published release notes remain unchanged, including their historical file references.

The v4 notes assume the latest v3 release and describe the breaking changes introduced in v4. General development, theming, and deployment guides describe current behavior and link to release-specific notes rather than carrying major-version migration instructions.

At minimum document the following in the fork migration notes and summarize the breaking changes in the relevant release/`Unreleased` entry.

#### Build configuration

Explain that `angular.json` changes structurally:

- the legacy split `browser` + `server` builders are replaced by the integrated `application` builder,
- the separate `server`, `serve-ssr`, and `prerender` targets are removed,
- the normal dev-server target changes to the modern `@angular/build` tooling,
- the test target changes to `@angular/build:unit-test`,
- i18n extraction moves to the `@angular/build` extraction path,
- obsolete Webpack-builder options disappear,
- production critical CSS inlining intentionally remains disabled.

State explicitly that forks with customized `angular.json` files should expect merge conflicts.

For locale conflicts, tell maintainers to preserve:

- the fork's own translated locale set,
- locale translation-file paths,
- locale-specific subpaths/base hrefs,
- locale-specific build configurations,
- the fork's `config.app.i18n.languages`,
- the fork's `config.app.i18n.defaultLanguage`,
- `sourceLocale: "aa"` unless the fork intentionally uses a different source-locale architecture.

Make clear that the base app's `sv`/`fi` list must **not** overwrite a fork's locale set.

#### SSR/server runtime

Document that:

- source `server.ts` moves to `src/server.ts`,
- `CommonEngine` is replaced by `AngularNodeAppEngine`,
- the emitted production server entry/output changes to the application-builder layout,
- `proxy-server.js` is removed,
- localized application dispatch is handled by the Angular Node app engine rather than a hardcoded locale array,
- request-specific Angular context moves away from the repository-owned Express request provider,
- auth-protected CSR handling moves from custom Express index-shell middleware to generated `RenderMode.Client` server routes,
- public routes continue to use runtime SSR,
- existing performance-oriented Express static/404/cache/rate-limit middleware remains intentionally in front of Angular rendering.

Call out that forks which modified `server.ts` or `proxy-server.js` must manually reapply those customizations to the new `src/server.ts` architecture rather than choosing one side of the conflict wholesale.

#### Build and runtime scripts/output

List every user-visible command or path change, including the final values after implementation:

- what `npm run build:ssr` now does,
- what `npm run serve:ssr` executes,
- the final browser output path,
- the final server output path/entry,
- whether `postbuild-copy-files.js` was removed,
- Docker start-command changes,
- nginx/static-volume changes if any.

Do not describe expected paths from the plan if the actual application-builder output differs; write the guide and release summary from the verified final implementation.

#### TypeScript/configuration files

Document removed or materially changed files, for example:

- `tsconfig.server.json` if removed after merging server settings,
- `tsconfig.app.json` server-source changes,
- `tsconfig.spec.json` changing from Jasmine to Vitest globals,
- generated server-route artifacts,
- removal of the old generated auth-protected-path artifact if it is no longer used.

This is particularly useful for forks that carry local edits in these files.

#### Unit testing

Document the Jasmine/Karma -> Vitest migration explicitly:

- `@angular/build:unit-test` is now the Angular test target,
- Vitest + `jsdom` replace Jasmine/Karma/headless Chrome,
- `karma.conf.js` is removed,
- the manual Angular TestBed bootstrap in `src/test.ts` is removed,
- `npm test` and `npm run test:ci` keep their intended developer/CI roles,
- Jasmine/Karma dependencies and APIs are removed,
- forks with custom `*.spec.ts` files must convert Jasmine spies, matchers, clocks, and other Jasmine-specific APIs to Vitest equivalents.

Also state that `src/ionicons-polyfill.ts` is intentionally retained and must still be loaded for tests, either through inherited application polyfills or the final documented Vitest setup.

#### Dependencies

List important direct dependency/tooling changes relevant to fork merges, especially:

- addition of Vitest/`jsdom`,
- removal of Jasmine/Karma packages,
- removal of `@angular-devkit/build-angular` if the final implementation no longer needs it,
- continued use of `@angular/build`.

Keep the release summary concise; list the dependency changes fork maintainers must reconcile in the fork migration notes, without reproducing the full lockfile diff.

#### Optional file-layout changes

If the optional `public/` migration was performed, give it its own breaking-change item and explicitly list:

- which paths moved,
- which source/build inputs deliberately stayed under `src/` (`src/project/config.ts`, `src/project/global-overrides.scss`, and `src/styles.scss`),
- confirmation that public request URLs did not change,
- likely conflict areas for forks with custom images, fonts, ebooks, files, sitemap/static HTML, or asset declarations.

If the `public/` migration was deferred, say nothing about it as a completed breaking change.

#### Fork migration checklist

Include a validation checklist in the fork migration notes specifically for downstream forks. It should instruct maintainers to:

1. merge/rebase the Stage 2 changes rather than replacing the fork's `angular.json`,
2. resolve `angular.json` by combining the new builder/test structure with the fork's own locale configuration,
3. reapply any fork-specific `server.ts`/Express middleware changes to `src/server.ts`,
4. verify the fork's `config.app.i18n.languages` and `defaultLanguage`,
5. convert any fork-only Jasmine tests to Vitest,
6. check any fork-specific Docker/nginx/runtime-script changes,
7. regenerate route/server-route artifacts,
8. run the fork's unit, SSR, locale, auth, Docker/nginx, and manual browser verification.

Where a breaking change has a straightforward old -> new mapping, show it directly in the fork migration notes. For example:

~~~text
server.ts                         -> src/server.ts
CommonEngine                      -> AngularNodeAppEngine
Karma/Jasmine                     -> Vitest + jsdom
@angular-devkit/build-angular:*   -> @angular/build:* where applicable
~~~

Keep the changelog concise enough to scan. The fork migration notes explain **what can conflict and what a fork maintainer must do**. Detailed implementation rationale remains in this Stage 2 plan; `docs/DEVELOPMENT.md` explains the current architecture.

Commit:

~~~text
docs: document application builder and Vitest architecture
~~~

### Phase 20 documentation checkpoint (2026-10-07)

Reviewed the merged phase 19 state `c86fe39` against the final source, Angular configuration, npm scripts, TypeScript/test setup, emitted output, Dockerfile, nginx/Compose configuration, and supplied GitHub Actions workflow. Rechecked Angular's SSR/testing guidance and the reference starter's current `main`, which still resolves to `d012cb4a9c8942ded25b95de37b6ceede87edfa9`. The final entry, integrated builders, ESM bootstrap, `AngularNodeAppEngine`, exported CLI handler, server-route providers, and Vitest/jsdom setup match that model. The application-specific locale/default-language, auth, request-context, static/proxy/limiter, critical-CSS, and Ionicons behavior remain intentional deviations documented above and in the current guides.

Finalized the architecture/testing guardrails in `AGENTS.md`, the development and production output/workflow documentation, README test instructions, and the concise `Unreleased` changelog. The dedicated v4 fork migration notes retain the detailed file/API/dependency mappings, merge-conflict guidance, locale preservation, custom-server/test adaptation, and fork validation checklist. No release version/tag is created. Removed the completed Stage 2 section from `docs/TODO.md`; the separate hydration migration and other deferred work remain.

This checkpoint changes documentation only. Verified 160 local links/anchors across 12 documents, 21 documented npm scripts, current build/runtime/test/output contracts, and consistent completion status. Published changelog entries are byte-for-byte unchanged, the hydration TODO is unchanged, and `git diff --check` passes. The local audit is recorded in `tmp/stage-2-phase-20/verification.json`. The source/build/test/deployment gates from phases 17–19 remain applicable and do not require another full runtime matrix for prose changes. Cloud CI runs and fork-specific deployment checks remain separate from the local documentation audit.

---

# Stage 2 completion criteria

Stage 2 is complete only when all of the following are true.

## Reference-model alignment

- The final Angular build/SSR architecture has been compared with the current `ng22-ion9-ssr-starter`.
- Any intentional deviations from the starter are documented by behavior, not accidental legacy carryovers.
- No starter-only prerender behavior was introduced.
- The app's Swedish-default unprefixed URL behavior is preserved unless separately approved.

## File layout

- SSR source entry lives at `src/server.ts`.
- The `server.ts` relocation was committed independently from SSR/API behavior changes.
- Application feature-folder organization was not changed merely to imitate a fresh CLI app.
- Project configuration and global overrides remain source/build inputs under `src/project/`; application-wide stylesheet inclusions live in `src/styles.scss`.
- If the optional `public/` migration was performed, static public URLs are unchanged and the move was isolated from behavioral changes.
- If the optional `public/` migration was deferred, that does not block Stage 2 completion.

## Build system

- The application build target uses Angular's integrated `application` builder.
- There is no separate legacy `server` build target.
- There is no legacy `serve-ssr` builder target.
- There is no legacy `prerender` builder target.
- `build:ssr` performs one integrated Angular production build after route generation.
- Obsolete Webpack-only builder options are removed.
- Critical CSS inlining remains explicitly disabled in production configuration.
- `@angular-devkit/build-angular` is no longer a direct dependency unless a concrete remaining requirement is documented.

## Server runtime

- `CommonEngine` is no longer used.
- `AngularNodeAppEngine` is the rendering engine.
- The server entry is ESM-compatible.
- No `__non_webpack_require__` or other Webpack/CommonJS-only server assumptions remain.
- The emitted `server.mjs`-style runtime can be started through `npm run serve:ssr`.
- Custom Express middleware still preserves required static, rate-limit, proxy, and cache behavior.
- Static files, known missing static files, `/static-html` misses, and non-SSR probe requests short-circuit before `AngularNodeAppEngine.handle()`.
- The SSR rate limiter applies to dynamic Angular requests without unnecessarily counting successful static requests or intentional fast-path responses.
- Allowed-host and trusted-proxy-header behavior is explicitly configured and tested.

## Rendering modes

- Server routes are generated/configured from the same production route/configuration inputs used by browser routing.
- Auth-disabled mode uses SSR for normal routes.
- Auth-enabled protected routes use `RenderMode.Client`.
- Public routes use `RenderMode.Server`.
- The old Express CSR-shell route matcher is removed.
- No unintended `RenderMode.Prerender` is introduced.

## Request handling

- Application services no longer depend directly on Express `Request`.
- Angular SSR request context supplies request-specific URL/header information.
- Canonical and Open Graph URL behavior is preserved.
- User-agent-based mobile/desktop SSR behavior is preserved.

## Localization

- `aa` remains the technical source locale and is not emitted as a production locale.
- `sv` remains a translated locale rather than becoming `sourceLocale` in the base app.
- Forks can still override Swedish phrases through the XLF translation workflow.
- Production SSR/build logic does not hardcode `sv`/`fi` or assume exactly two locales.
- A fork can retain a single production locale or a different multi-locale set when resolving the Stage 2 `angular.json` migration.
- The default unprefixed locale behavior is derived from fork configuration rather than a hardcoded locale list.
- Swedish and Finnish production output both work in the base repository.
- `/sv` and `/fi` routing work.
- The approved default Swedish/unprefixed behavior works.
- Locale assets and SEO metadata are correct.
- `ng-extract-i18n-merge` uses the `@angular/build` extraction path.
- Translation extraction produces no unintended XLF churn.

## Unit testing

- Test target uses `@angular/build:unit-test`.
- Vitest is the test runner.
- `jsdom` is the default test environment.
- `tsconfig.spec.json` uses `vitest/globals` rather than Jasmine types.
- `src/test.ts` manual TestBed initialization is removed.
- Ionicons test initialization is handled through inherited application polyfills or a minimal documented setup file.
- No direct Jasmine/Karma dependency remains.
- No `karma.conf.js` remains.
- No `jasmine.*` API remains in active test code.
- Timer tests use Vitest fake timers or native async techniques.
- The post-migration suite preserves the behavioral coverage of the pre-migration suite.
- `npm test` and `npm run test:ci` both work as documented.

## Deployment

- Docker builds successfully.
- The production container starts successfully.
- nginx serves the application-builder browser output correctly.
- gzip-static assets still work.
- Docker Compose deployment works.
- GitHub Actions Docker build works.

## Testing and verification

- Unit tests pass under Vitest.
- Route parser/generator tests pass.
- Source encoding test passes.
- Development builds pass.
- Production application build passes.
- SSR smoke tests pass.
- Auth-enabled and auth-disabled rendering matrix passes.
- Container and nginx gates pass.
- Manual browser gate passes.
- i18n extraction passes.
- Build/runtime/test benchmark comparison has been reviewed.

## Architecture

- Application remains standalone.
- `src/ionicons-polyfill.ts` remains part of the application startup/polyfill path.
- Application-owned Ionicons remain registered centrally rather than in component constructors.
- Representative Ionicons work in SSR output, after client bootstrap, and in unit tests.
- Application remains zoneless.
- Ionic remains standalone except for the intentional server provider bridge.
- Hydration remains disabled.
- Stage 2 documentation is updated.
- The application-builder migration TODO is removed from the active TODO list.
