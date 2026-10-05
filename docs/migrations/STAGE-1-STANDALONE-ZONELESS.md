# Angular 22 modernization — Stage 1: standalone and zoneless migration

> [!NOTE]
> **Status: Completed for release 3.1.0.** This plan is retained as a historical implementation record. Its commands, paths, and dependency references describe the migration period and may become outdated; the current repository configuration and [development notes](../DEVELOPMENT.md) take precedence.

This was the first stage of the repository's [two-stage Angular modernization](README.md) from an Angular 20-era architecture using legacy APIs to a modern Angular 22 architecture. It produced a fully standalone, zoneless application while retaining the existing Webpack browser/server builders, `CommonEngine`, output layout, deployment model, and non-hydrated SSR.

## Test levels

Use these consistently so each commit has an appropriate gate.

### Fast gate

```powershell
npm run test:source-encoding
npm run test:routes-parser
npm run test:ci
npx ng build --configuration development,sv
```

### Full SSR gate

```powershell
npm run build:ssr
npm run serve:ssr
```

Then, from another terminal:

```powershell
npm run test:ssr:smoke
```

Confirm the output remains:

```text
dist/app/browser/{sv,fi}
dist/app/server/{sv,fi}/main.js
dist/app/proxy-server.js
```

### Manual browser gate

At relevant milestones, test:

- Desktop and mobile navigation
- Ionic outlet history and cached-page behavior
- Side menus and loading bar
- Collection navigation
- Search, index, media collection, and ebooks
- Modals, popovers, filters, and image viewers
- Authentication flows when auth is enabled
- Both Swedish and Finnish builds

---

## 1. Establish and record the pre-migration baseline

Do not change application behavior yet.

Work:

- Run the fast gate.
- Run the full SSR gate.
- Confirm the existing SSR assertions for:
  - `/sv/collection/203/introduction`
  - `/sv/index/persons`
- Record the current output layout.
- Optionally run `npm run bench:ssr:build` and retain the results for final comparison.
- Confirm hydration is not configured.
- Confirm the working tree is clean after route generation.

Commit:

- No commit if everything already passes and no files change.
- If baseline regression tests are added:  
  `test(migration): capture standalone migration baseline`

---

## 2. Add routing and bootstrap regression coverage

Add coverage before changing route structure.

Work:

- Add route-recognition tests for all distinct route shapes:
  - `/`
  - `/about` and `/about/:id`
  - Policy pages carrying parent route data
  - `/article/:name`
  - Collection cover, title, foreword, and introduction
  - Collection text with publication and optional chapter
  - All three ebook forms
  - Search with and without a query
  - Media collection with and without an ID
  - Index routes
  - Auth routes, guards, redirects, and wildcard
- Cover route data and parameter inheritance, not only URL matching.
- Add a regression test for `AboutPage`’s use of parent route data.
- Add provider-oriented tests where practical for:
  - Custom router preloading strategy
  - Conditional auth interceptor registration
  - Browser/server implementation selection
- Ensure asynchronous component tests do not rely solely on forced `fixture.detectChanges()` after the tested update.

Verify:

- Fast gate.
- No production code changes.

Commit:

```text
test(router): lock current lazy-route behavior
```

---

## 3. Convert page components to standalone behind compatibility NgModules

Convert pages first without changing lazy routing, bootstrap, Zone.js, or change-detection strategy.

For each page:

- Remove `standalone: false`; do not add `standalone: true`, because it is the Angular 22 default.
- Keep its existing `Eager` or `OnPush` strategy unchanged.
- Move template dependencies from the page NgModule into the component’s `imports`.
- Prefer individual standalone Ionic components from `@ionic/angular`.
- Keep the existing page routing module.
- Temporarily turn the page NgModule into a compatibility wrapper:
  - Remove the page from `declarations`.
  - Import the standalone page and its routing module.
  - Remove template imports that have moved to the page.
- Update page tests from `declarations: [Page]` to `imports: [Page]`.
- Do not perform signal or asynchronous-state refactoring in these commits.

Suggested batches follow.

### 3.1 Small pages

- `AccountPage`
- `ContentPage`
- `PageNotFoundPage`

Verify:

- Fast gate.
- Navigate to the three routes.

Commit:

```text
refactor(pages): convert small pages to standalone
```

### 3.2 Authentication pages

- `LoginPage`
- `RegisterPage`
- `ForgotPasswordPage`
- `ResetPasswordPage`
- `VerifyEmailPage`

Verify:

- Fast gate.
- Verify form validation.
- Verify reset/verification token handling.
- Test both auth-enabled and auth-disabled route behavior where possible.

Commit:

```text
refactor(auth): convert authentication pages to standalone
```

### 3.3 General content pages

- `HomePage`
- `AboutPage`
- `ArticlePage`
- `EbookPage`

Verify:

- Fast gate.
- Check Markdown and `[innerHTML]` output.
- Check article and about-page relative navigation.
- Check all ebook route shapes.

Commit:

```text
refactor(pages): convert content pages to standalone
```

### 3.4 Collection front-matter pages

- `CollectionCoverPage`
- `CollectionTitlePage`
- `CollectionForewordPage`

Verify:

- Fast gate.
- Check Ionic enter/leave behavior and text changer state.
- Check dialogs and popovers.

Commit:

```text
refactor(collection): convert front-matter pages to standalone
```

### 3.5 Data-heavy pages

Convert these separately so failures remain attributable:

1. `IndexPage`
2. `MediaCollectionPage`
3. `ElasticSearchPage`

Verify after each page:

- Fast gate.
- Filters and query parameters.
- Route reuse when leaving and returning.
- Loading, error, empty, and populated states.
- Modal behavior where applicable.

Commits:

```text
refactor(index): convert index page to standalone
refactor(media): convert media collection page to standalone
refactor(search): convert elastic search page to standalone
```

### 3.6 Collection introduction

Convert `CollectionIntroductionPage` alone.

Verify:

- Fast gate.
- Full SSR gate, especially `/sv/collection/203/introduction`.
- Links, tooltips, dialogs, browser listeners, and Ionic lifecycle behavior.

Commit:

```text
refactor(collection): convert introduction page to standalone
```

### 3.7 Collection text

Convert `CollectionTextPage` alone.

Verify:

- Fast gate.
- Full SSR gate.
- All publication/chapter route shapes.
- View-option changes.
- Ionic cached-page lifecycle.
- Tooltips, overlays, dialogs, scrolling, and delegated DOM events.
- Facsimile, manuscript, variant, illustration, comment, and reading-text views.

Commit:

```text
refactor(collection): convert text page to standalone
```

At this checkpoint, every page is standalone, but the existing lazy NgModules still provide route-compatible wrappers.

---

## 4. Replace page routing NgModules incrementally

Preserve both URLs and `ActivatedRoute` hierarchy.

### Routing rule

Use direct `loadComponent` only when replacing the route does not change observable route behavior.

For routes with non-empty child paths, multiple route forms, parent data, parent guards, or relative navigation dependencies, create lazy standalone route arrays:

```typescript
export const featureRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./feature.page').then(m => m.FeaturePage),
  },
];
```

The top-level route may continue using `loadChildren`, but it now loads a `Routes` array rather than an NgModule.

### 4.1 Convert simple routes

Convert routes whose old feature route only contains `path: ''`, where route-tree tests prove direct `loadComponent` is equivalent.

After converting each group:

- Delete its page module.
- Delete its routing module.
- Run `npm run generate-routes`.
- Commit the canonical and generated route files together.

Verify:

- Route tests.
- Fast gate.

Commit:

```text
refactor(router): use standalone components for simple routes
```

### 4.2 Convert nested and multi-shape routes

Use standalone lazy route arrays for at least:

- About and policy pages
- Articles
- Collection text
- Ebooks
- Search
- Media collection

Preserve:

- Parent route data
- Guard placement and execution order
- `ActivatedRoute.parent`
- Parameter inheritance
- Relative navigation behavior
- Route ordering

Delete the corresponding NgModule and routing-module files only after each replacement is active.

Verify:

- Route-recognition tests for every URL form.
- `npm run generate-routes`.
- `npm run test:routes-parser`.
- Full SSR gate.
- Manual lazy-loading and Ionic history checks.

Commit:

```text
refactor(router): replace feature NgModules with standalone route arrays
```

### 4.3 Update the route generator

Work:

- Update comments that refer to `AppRoutingModule`.
- Update parser fixtures to contain `loadComponent` and standalone route-array examples.
- Confirm filtering remains keyed by the existing top-level paths.
- Test both feature-based routing modes.
- Confirm auth-protected path generation remains unchanged.
- Regenerate:
  - `app.routes.generated.ts`
  - `auth-protected-route-paths.generated.ts`

Verify:

- Fast gate.
- Ensure a second generation produces no additional diff.

Commit:

```text
test(routes): update generation coverage for standalone routes
```

---

## 5. Convert root and server bootstrap together

Browser and server bootstrap should change in the same commit so the repository never has a broken SSR midpoint.

### Browser configuration

Create `app.config.ts` containing:

- `provideZoneChangeDetection()` temporarily
- `provideBrowserGlobalErrorListeners()`
- `provideIonicAngular({mode: 'md'})`
- `{provide: RouteReuseStrategy, useClass: IonicRouteStrategy}`
- `provideRouter(...)` with:
  - `withPreloading(RouterPreloadingStrategyService)`
  - `withEnabledBlockingInitialNavigation()`
  - `withRouterConfig({paramsInheritanceStrategy: 'emptyOnly'})`
- `provideHttpClient(...)`
- Conditional auth interceptor
- Browser implementations of the platform-specific services

Provide `HttpClient` only once.

### Server configuration

Create `app.config.server.ts` that merges the browser configuration with server-only providers registered afterward:

- `provideServerRendering()` from `@angular/platform-server`
- `importProvidersFrom(IonicServerModule)`
- Server implementations of all platform-specific service abstractions

Do not introduce:

- `provideServerRendering(withRoutes(...))` from `@angular/ssr`
- `app.routes.server.ts`
- `RenderMode`
- `AngularNodeAppEngine`

Those belong to Stage 2.

### Bootstrap and root component

- Convert `AppComponent` to standalone.
- Keep `ChangeDetectionStrategy.Eager` temporarily.
- Import its template dependencies directly.
- Change `main.ts` to `bootstrapApplication(AppComponent, appConfig)`.
- Preserve `enableProdMode()`.
- Change `main.server.ts` to call `bootstrapApplication` with the merged configuration and `BootstrapContext`.
- Update `server.ts` to pass the bootstrap function to `CommonEngine`.
- Keep request-level providers and all Express behavior unchanged.
- Delete:
  - `app.module.ts`
  - `app.server.module.ts`
  - `app-routing.module.ts`
- Update comments in platform-specific services that refer to the deleted modules.

### Builder restriction

The only permitted `angular.json` changes in Stage 1 are later Zone.js polyfill removals. Do not change:

- Builder names
- Build targets
- Output paths
- Localization layout
- Server entry
- SSR/prerender targets

Verify:

- Fast gate.
- Full SSR gate.
- Manual browser gate.
- Confirm browser and server provider implementations are selected correctly.
- Confirm `IonicRouteStrategy` is active.
- Confirm output layout is unchanged.

Commit:

```text
refactor(core): bootstrap browser and server as standalone applications
```

---

## 6. Remove remaining deprecated IonicModule usage

After deleting page wrappers, migrate the remaining reusable components and dialogs away from `IonicModule`.

Suggested batches:

1. Root shell, menus, content grid, date histogram, PDF viewer
2. Collection text-type components
3. Modals, popovers, and authentication status components

For each component:

- Replace `IonicModule` with the exact standalone Ionic components used by its template.
- Import standalone components and controllers from `@ionic/angular`.
- Preserve the `IonicRouteStrategy` application provider.
- Document any intentional exception rather than retaining an accidental module import.

Verify after each batch:

- Fast gate.
- Relevant manual UI interactions.
- Full SSR gate after the final batch.

Commits:

```text
refactor(ionic): use standalone imports in shared components
refactor(ionic): use standalone imports in collection components
refactor(ionic): use standalone imports in overlays
```

Checkpoint:

```powershell
rg "IonicModule|@ionic/angular/lazy" src/app
```

The intended result is no matches unless a reviewed exception is documented.

---

## 7. Make the test environment zoneless

Do this before converting application state so subsequent tests exercise zoneless scheduling.

Work:

- Rewrite the four `fakeAsync`/`tick` auth tests using native async testing, Jasmine’s clock, or an injected timer abstraction.
- Remove `zone.js` and `zone.js/testing` from the test target’s polyfills.
- Remove `import 'zone.js/testing'` from `src/test.ts`.
- Keep browser and server Zone.js runtime configuration temporarily.
- Update asynchronous component tests to use `fixture.whenStable()` and DOM assertions.
- Avoid manual `detectChanges()` after the specific asynchronous update under test, because it can hide a missing zoneless notification.

Verify:

- Run the entire unit suite.
- Confirm the suite runs without loading Zone.js.
- Fast browser build.

Commit:

```text
test(core): run Angular tests without Zone.js
```

---

## 8. Prepare application state for zoneless operation

Production remains Zone-based during these commits. Each component becomes zoneless-safe before the final switch.

For every affected component, inspect:

- Observable subscriptions
- Promises and `async` methods
- Timers
- Router events
- Ionic lifecycle callbacks
- Modal and popover results
- Renderer and native browser listeners
- Image-loading callbacks
- `afterNextRender` and `afterRenderEffect`
- Services that mutate template-facing state indirectly

Use:

- Signals for mutable template-facing state
- `computed()` for derived state
- `toSignal()` for suitable observable state
- `AsyncPipe` where the observable is naturally template-owned
- `markForCheck()` only when signal conversion is inappropriate

Do not rely on `NgZone.run()` as a change notification. Retain `runOutsideAngular()` only where it still has a documented non-change-detection purpose.

Once an `Eager` component is proven zoneless-safe, remove its explicit strategy so it uses Angular 22’s default OnPush behavior. A retained `Eager` strategy must be justified and tested.

### 8.1 Root shell

Convert asynchronous state in `AppComponent`, including:

- Router navigation state
- Side-menu selection and visibility
- Loading-bar timer
- Mobile-mode state
- Collection ID and route parameters

Verify:

- Zoneless root-component tests.
- Fast gate.
- Manual navigation and loading bar.

Commit:

```text
refactor(core): make application shell zoneless-safe
```

### 8.2 Authentication pages

Audit all auth pages and authentication-related UI state.

Verify:

- Full auth unit suite.
- Form and redirect behavior.
- Token callback and delayed feedback behavior.

Commit:

```text
refactor(auth): make authentication UI zoneless-safe
```

### 8.3 General content pages

Audit:

- Home
- Content
- About
- Article
- Ebook
- Page not found

Verify:

- Markdown updates.
- Route changes while a component is reused.
- Ebook and article navigation.
- Listener cleanup.

Commit:

```text
refactor(pages): make content pages zoneless-safe
```

### 8.4 Navigation and shared components

Audit:

- Top, main-side, and collection-side menus
- Content grid
- Text changer
- Date histogram
- PDF viewer
- Static HTML
- Draggable image and MathJax directives
- Services using timers or `NgZone`

Verify:

- Menu updates after navigation.
- Deferred collection side menu.
- Dragging and scrolling.
- PDF parameter updates.
- Preloading behavior.

Commit:

```text
refactor(components): make shared UI zoneless-safe
```

### 8.5 Search, index, and media collection

Audit each feature separately if needed.

Verify:

- Loading, results, errors, filters, and pagination.
- Query-parameter changes.
- Image source resolution.
- Modal interactions.

Commits:

```text
refactor(index): make index page zoneless-safe
refactor(media): make media collection zoneless-safe
refactor(search): make search page zoneless-safe
```

### 8.6 Collection front matter and introduction

Audit:

- Cover
- Title
- Foreword
- Introduction

Verify:

- Ionic lifecycle updates.
- Content reload after route reuse.
- View options, tooltips, overlays, and scroll behavior.
- Full SSR gate for the introduction route.

Commit:

```text
refactor(collection): make front matter zoneless-safe
```

### 8.7 Collection text and dependent components

Audit the collection text page and all its subordinate views together:

- Reading text
- Comments
- Variants
- Manuscripts
- Metadata
- Legend
- Illustrations
- Facsimiles
- Tooltips and overlays
- Modal callbacks
- Delegated DOM listeners
- Timers and scrolling

Verify:

- Focused unit tests for asynchronous updates.
- Every supported text view and view combination.
- Desktop and mobile behavior.
- Ionic page caching and repeated entry/leave cycles.
- Full SSR gate.

Commit:

```text
refactor(collection): make text views zoneless-safe
```

---

## 9. Enable zoneless change detection in the application

At this point the application should already be compatible.

Work:

- Remove `provideZoneChangeDetection()` from the browser configuration.
- Do not add a replacement provider; Angular 22 is zoneless by default.
- Leave the Zone.js scripts loaded for this one checkpoint so this commit isolates Angular’s scheduling-mode change from removal of the library itself.
- Optionally use `provideCheckNoChangesConfig` temporarily during local verification; do not retain an interval-based diagnostic in production without a deliberate decision.

Verify:

- Fast gate.
- Full SSR gate.
- Full manual browser gate.
- Pay particular attention to updates that happen after the initial render.
- Confirm SSR completes without stability timeouts.

Commit:

```text
refactor(core): enable zoneless change detection
```

---

## 10. Remove Zone.js completely

Work:

- Remove `zone.js` from browser polyfills in `angular.json`.
- Remove `import 'zone.js/node'` from `server.ts`.
- Remove the obsolete Zone.js comment from the environment file.
- Remove `zone.js` from `package.json`.
- Regenerate `package-lock.json`.
- Do not change any builder or output option.

Verify:

```powershell
rg "zone\.js|provideZoneChangeDetection" src server.ts angular.json package.json
npm ls zone.js
```

Because Ionic declares Zone.js as optional, it should not need to remain installed.

Then run:

- Fast gate.
- Full SSR gate.
- Full manual browser gate.
- Optional SSR benchmark comparison.

Commit:

```text
build: remove Zone.js from the application
```

---

## 11. Final route/configuration matrix

Before documentation, run the complete matrix.

Verify:

- Normal configuration with `featureBasedRoutes: false`
- Feature-filtered route generation
- Auth-disabled configuration
- Auth-enabled route generation and client-rendered protected routes
- Both Swedish and Finnish production output
- Wildcard and missing-static-file handling
- `/sv/collection/203/introduction`
- `/sv/index/persons`
- SSR canonical and Open Graph URLs
- Proxy headers and allowed-host behavior
- Existing rate limiting
- Static HTML and collection-menu behavior
- Browser navigation into and out of lazy-loaded pages
- Modal/popover behavior across cached Ionic pages

Confirm that no hydration provider was introduced.

If fixes are needed, commit them by feature rather than as one miscellaneous migration commit.

---

## 12. Update documentation and changelog

Update:

- [DEVELOPMENT.md](../DEVELOPMENT.md)
- Relevant README architecture references
- Comments in services and route-generation scripts
- `CHANGELOG.md`

Document:

- Standalone bootstrap files
- Browser/server configuration split
- Intentional `importProvidersFrom(IonicServerModule)` bridge
- Angular 22 default zoneless behavior
- Zone.js removal
- Standalone route structure
- Preservation of legacy Webpack builders
- Explicit deferral of hydration
- Explicit deferral of `CommonEngine` and application-builder migration to Stage 2

Verify:

- Source-encoding test.
- Route-parser test.
- Documentation contains no stale references to deleted application NgModules.

Commit:

```text
docs: document standalone zoneless architecture
```

---

## Stage 1 completion criteria

Stage 1 is complete only when:

- No application or page component has `standalone: false`.
- No repository-owned `@NgModule` remains under `src/app`.
- `IonicServerModule` is consumed only through `importProvidersFrom`.
- No unintended `IonicModule` dependency remains.
- Route URLs, hierarchy, guards, data, parameters, and generated filtering are preserved.
- Browser and server bootstrap use `bootstrapApplication`.
- Browser and server provider implementations remain equivalent to the old modules.
- No `provideZoneChangeDetection`, Zone.js import, polyfill, or package dependency remains.
- Every retained `Eager` component is explicitly justified and tested.
- Hydration remains disabled.
- The Webpack builder names and SSR targets are unchanged.
- The existing `dist/app` layout is unchanged.
- All unit, route-generation, browser-build, SSR smoke, and manual feature checks pass.
- The two required SSR routes still return their expected initial HTML.
