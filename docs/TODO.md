# Cross-cutting TODOs

This document tracks cross-cutting TODOs that should stay visible outside local code comments.

## nginx rate limiting for SSR backend

- nginx rate limiting is currently not enabled; app-level limiting is handled in `src/server.ts` (`express-rate-limit`).
- Consider re-enabling nginx edge rate limiting later for defense in depth.
- Why postponed: correct per-user limiting in nginx depends on verified real client IP forwarding/trust configuration across proxy chain(s) (for example LB/HAProxy/nginx). A wrong config can collapse many users into one bucket or trust spoofable headers.

## TypeScript compiler follow-ups

Consider these changes to the shared [TypeScript configuration](../tsconfig.json):

- **Enable `noPropertyAccessFromIndexSignature`:** define explicit types for [`src/project/config.ts`](../src/project/config.ts) and other affected dictionary values, then distinguish known properties from dynamic keys before enabling the check.

## Route prerendering after the redesign

**Status: postponed in full until the planned UI redesign**, including replacing Ionic with Angular Material and/or custom elements. Investigation completed in October 2026; prerendering has not been enabled in the app.

### Main blocker: device-dependent initial layout

- [`PlatformService`](../src/app/services/platform.service.ts) uses the request user agent during SSR and the browser user agent after bootstrap. Prerendering has no live request/user agent, so the current app produces desktop HTML for every visitor.
- This changes structure and behavior, not just styling. The [collection introduction page](../src/app/pages/collection/introduction/collection-introduction.page.html) places text navigation in the toolbar on desktop and below the content on mobile; its separate TOC initially opens on desktop but stays closed on mobile. The [shared app shell](../src/app/app.component.html) also changes sidebar/backdrop behavior, so home and content are not exempt.
- Serving desktop HTML to mobile users would change the layout when Angular starts. Hydration is currently disabled, so the browser already recreates the rendered DOM and reloads content; the extra layout change could make that transition more disruptive. See [Hydration migration](#hydration-migration).
- Design requirement for the future overhaul: the initial HTML should support both layouts without knowing the request user agent. Different desktop/mobile presentations can remain, using responsive placement and styling. Replacing Ionic alone will not resolve this if templates still select their initial structure through user-agent sniffing.
- Desktop/mobile prerender variants or desktop prerendering with mobile SSR are technically possible, but require custom build/dispatch and cache handling. Merely forwarding mobile requests to the existing Node handler would still serve the same prerendered HTML. Avoid investing in these workarounds ahead of the redesign.

### Intended scope and configuration

- **Stage 1:** prerender the home route (`''`) and `content`. `home` is an alias redirect to `''`; preserve its HTTP redirect rather than treating it as another content page. Start with an explicit route allowlist rather than selecting every non-parameterized path: some routes depend on query parameters, authentication, or parameterized lazy children.
- **Stage 2:** enable prerendering of `collection/:collectionID/introduction` through another config flag. Enumerate configured collection IDs as strings with Angular's `getPrerenderParams()`, respecting introduction feature settings, per-collection exclusions, and actual content availability in each locale. Retain `PrerenderFallback.Server` for introductions outside the generated set.
- Proposed settings under `app.prebuild` in [`config.ts`](../src/project/config.ts), **not implemented**:

  ```typescript
  prerender: {
    enabled: false,
    routes: ['', 'content'],
    collectionIntroductions: false
  }
  ```

- The master flag must default to disabled. Disabling it must preserve current rendering modes, including client rendering of protected routes when auth is enabled. Auth protection must take precedence over prerender selection, and feature-based route filtering must still apply. Config changes require rebuilding and redeploying.

### Findings and implementation starting points

- **Existing build supports mixed modes:** Angular 22.2.1's installed application builder already runs the prerender pipeline with the current `outputMode: "server"`. Keep the integrated browser/server build and Node SSR fallback. Extend [`prebuild-generate-routes.js`](../prebuild-generate-routes.js) to emit selected `RenderMode.Prerender` entries before the `RenderMode.Server` wildcard; do not edit ignored generated route files manually. See [Angular hybrid rendering](https://angular.dev/guide/ssr).
- **Prototype verified feasibility:** a temporary production build emitted home, content, and collection 203's introduction in Swedish and Finnish (six pages). Build-output checks passed. Node served the emitted HTML without API requests, including unprefixed URLs and introduction URLs with query parameters. This established feasibility, not production readiness; the original generated route configuration was restored.
- **Fix render-time origin and path handling:** Angular's request tokens are null during prerendering. [`DocumentHeadService`](../src/app/services/document-head.service.ts) used the temporary build server's `localhost` origin instead of `app.siteURLOrigin`. [`ServerRouterNavigationSourceService`](../src/app/services/router-navigation-source.service.ts) used an early `router.url` snapshot, causing content/introduction pages to receive home metadata and navigation state. Add reliable prerender origin/path handling, preserving locale/base-path rules and current request-based SSR behavior.
- **Fail the build on missing content:** the prototype initially built successfully despite blocked backend requests. Markdown and introduction loading currently catch errors and return empty/error content. When prerendering is enabled, required content must be validated and loading failures, empty data, or missing-file responses must fail the build rather than publish incomplete pages. Preserve the intended runtime error behavior for ordinary SSR/browser requests.
- **Serve and cache generated HTML deliberately:** [`nginx.conf`](../nginx.conf) needs route-specific `index.html` lookups for localized and default-language URLs, retaining Node fallback for other routes. Use revalidation or a short HTML cache lifetime. [`src/server.ts`](../src/server.ts) currently gives explicit generated HTML file URLs a one-year cache lifetime, while clean prerender URLs pass through the SSR limiter before Angular serves them. Keep hashed asset caching separate, and ensure redeployment removes stale prerendered files when the feature is disabled.
- **Reuse existing compression:** [`Dockerfile`](../Dockerfile) already runs `npm run compress` after the build, and that script includes HTML recursively under `dist/app/browser`. Ensure route HTML receives `.gz` siblings where eligible and nginx serves them through the existing `gzip_static` setup.
- **Content becomes a build-time snapshot:** the backend must be reachable during builds, and backend edits to prerendered content require rebuilding/redeploying. Generate and validate all emitted locales, not just the default-language sitemap URLs.
- **Performance scope:** prerendering removes API fetching and Angular rendering from the initial server response. It does not automatically accelerate navigation within the running app or eliminate browser content refetching/reconstruction. Hydration can support startup DOM/data reuse; faster in-app navigation needs its own content caching/loading strategy. Large introduction HTML still needs transfer and parsing; the tested Swedish introduction was about 933 kB uncompressed. Measure API latency, server rendering, transfer, and browser work separately before promising loading-time improvements.

### Verification and documentation when resumed

- Add generator coverage for flags off/on, auth precedence, feature filtering, parameter enumeration, and exclusions. Validate emitted HTML/content/SEO in every locale and ensure missing backend content fails the build.
- Extend [`test-build-output.js`](../scripts/test-build-output.js), [`test-ssr-smoke.js`](../scripts/test-ssr-smoke.js), and server middleware checks for mixed SSR/prerender/CSR behavior. The smoke runner currently recognizes `ng-server-context="ssr"` only; prerendered roots use `"ssg"`.
- Verify mobile/desktop initial layouts and browser startup, unprefixed/default-locale handling, redirects, query-driven behavior, SSR fallback, nginx HTML caching, gzip delivery, and removal of stale output when disabled.
- Document the implemented config in [CONFIGURATION.md](CONFIGURATION.md) and [PROJECT-CUSTOMIZATION.md](PROJECT-CUSTOMIZATION.md), implementation details in [DEVELOPMENT.md](DEVELOPMENT.md), build/deployment implications in [DEPLOYMENT.md](DEPLOYMENT.md), and the released behavior in [CHANGELOG.md](../CHANGELOG.md).

## Hydration migration

Current status:

- Client hydration is intentionally not enabled; no hydration provider is registered because Ionic's underlying Stencil components do not currently support SSR hydration with Angular. See [Application architecture](DEVELOPMENT.md#application-architecture) and [ionic-team/ionic-framework#30490](https://github.com/ionic-team/ionic-framework/issues/30490).
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
