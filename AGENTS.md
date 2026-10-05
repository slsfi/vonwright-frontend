# Repository Guidelines

This repository contains the base frontend for SLS digital editions: an Angular web app with server-side rendering (SSR).  
It is intended to be forked per edition/project, with most behavior controlled through configuration (primarily [`src/assets/config/config.ts`](src/assets/config/config.ts)).  
When contributing, changes must be reusable and config-driven; project-specific hardcoding is not allowed in this base repository.

## Project Structure & Module Organization
- Browser and server entry points are `src/main.ts` and `src/main.server.ts`.
- Shared application providers live in `src/app/app.config.ts`; server-specific providers and overrides live in `src/app/app.config.server.ts`.
- `src/app/` contains application code:
  - `components/` reusable UI components.
  - `pages/` route entry pages and lazy standalone `Routes` arrays (`*.routes.ts`) where needed.
  - `services/`, `guards/`, `interceptors/`, `tokens/`, `models/`.
- `src/assets/config/config.ts` is the main feature/config switchboard (auth, SSR, prebuild flags, menus, etc.).
- Route artifacts are generated at build time:
  - canonical developer-edited routes: `src/app/app.routes.ts`
  - generated production routes: `src/app/app.routes.generated.ts`
  - generated auth-protected paths: `src/app/auth-protected-route-paths.generated.ts`
- Build/helper scripts live in repo root (`prebuild-*.js`, `postbuild-copy-files.js`).
- Operational and architecture notes are in `docs/` (especially `DEVELOPMENT.md`, `DEPLOYMENT.md`).

## Architecture Guardrails
- Keep the application standalone. Do not introduce application, server, page, or routing NgModules.
- Import Ionic components as standalone components rather than through `IonicModule`. `importProvidersFrom(IonicServerModule)` in the server configuration is the intentional application-level NgModule bridge.
- Keep the application zoneless. Do not add Zone.js, `provideZoneChangeDetection()`, or another compatibility provider as a workaround; expose asynchronous template state through signals, inputs, the `async` pipe, or another Angular notification mechanism.
- Preserve the current SSR architecture unless the task is explicitly a dedicated migration: `CommonEngine`, separate `browser`/`server` builders, and the `dist/app` output contract are intentional.
- Do not enable client hydration or migrate to Angular's `application` builder as part of unrelated work.
- Register application-owned Ionicons centrally in `src/ionicons-polyfill.ts`; do not add component-local `addIcons()` registrations.
- See `docs/DEVELOPMENT.md` for the detailed architecture rationale and migration notes.

## Build, Test, and Development Commands
- `npm ci` - clean dependency install from `package-lock.json`; supported Node/npm versions are declared in `package.json`.
- `npm start` - local Angular dev server.
- `npm test` - run Angular/Jasmine unit tests in Karma watch mode.
- `npm run test:ci` - run the Angular/Jasmine unit test suite once in headless Chrome.
- `npm run test:source-encoding` - validate source-file encoding and BOM usage.
- `npm run test:routes-parser` - smoke tests for route parser/generator logic.
- `npm run test:static-collection-menus` - verify static collection-menu generation and shared prebuild fetch retry behavior.
- `npm run build:ssr` - generate routes + browser/server production build.
- `npm run serve:ssr` - run built SSR app from `dist/`.
- `npm run test:ssr:smoke` - verify key SSR responses against a running SSR app.
- `npm run ssr-start` - build SSR and serve in one command.
- `npm run generate-routes` - regenerate route artifacts from config.
- `npm run bench:ssr:build` - build and benchmark SSR performance.

## Coding Style & Naming Conventions
- Use TypeScript + Angular templates/SCSS; follow existing style (2-space indentation, concise comments).
- Keep files and selectors in kebab-case; classes/interfaces in PascalCase.
- Use established suffixes (`*.service.ts`, `*.guard.ts`, `*.interceptor.ts`).
- Prefer existing path aliases (for example `@services`, `@components`, `@config`).
- Keep behavior config-driven; hardcoding fork-specific values is not allowed.

## Testing Guidelines
- Angular unit tests use Jasmine + Karma and live in `src/**/*.spec.ts`. Add or update specs for changed components, pages, services, guards, interceptors, configuration, and routes as appropriate.
- Use `npm test` while developing and `npm run test:ci` for a single-run verification before PRs.
- Script-based checks complement the unit suite: use `test:source-encoding` for source encoding, `test:routes-parser` for route-generation/parser changes, and `test:ssr:smoke` for SSR behavior.
- Run `test:static-collection-menus` after changing `prebuild-generate-static-collection-menus.js` or shared fetch retry behavior in `prebuild-common-fns.js`.
- When changing `app.routes.ts` or lazy `*.routes.ts` files, update/run the Angular route-recognition specs; also run `test:routes-parser` when generator-facing route syntax changes.
- For SSR changes, run `build:ssr`, start the built app with `serve:ssr`, then run `test:ssr:smoke` (or point the smoke test at another running environment with `--base-url`).

## Commit & Pull Request Guidelines
- Follow conventional commits seen in history (for example `feat(ssr): ...`, `fix(auth): ...`, `docs: ...`).
- Keep commits focused to one logical change.
- PRs should include:
  - summary of behavior change and rationale,
  - config/deployment impact (especially `src/assets/config/config.ts` and SSR/auth flags),
  - verification steps and commands run,
  - screenshots for UI changes when relevant.
- Update `CHANGELOG.md` and docs for user-visible or operational changes.

## Security & Configuration Tips
- Do not commit secrets in config or environment files.
- Auth is optional and disabled by default; forks enabling auth must validate SSR/auth behavior explicitly.
- Edit `src/app/app.routes.ts` as the canonical route source. Do not manually edit `src/app/app.routes.generated.ts` or `src/app/auth-protected-route-paths.generated.ts`; regenerate them with the repository scripts.
