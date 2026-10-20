# Repository Guidelines

This repository provides the shared Angular/Ionic frontend for SLS digital editions, with localization and SSR. Keep changes reusable and configuration-driven.

## Documentation

Use [DEVELOPMENT.md](docs/DEVELOPMENT.md) for base-app architecture, implementation, and verification. Consult relevant sections for the task; start with [Application architecture](docs/DEVELOPMENT.md#application-architecture) when getting oriented. [PROJECT-CUSTOMIZATION.md](docs/PROJECT-CUSTOMIZATION.md) covers fork settings, [THEMING.md](docs/THEMING.md) styling, [AUTHENTICATION.md](docs/AUTHENTICATION.md) authentication, and [DEPLOYMENT.md](docs/DEPLOYMENT.md) building/deployment. Keep fork configuration instructions out of development notes.

## Project Structure

- `src/app/`: components, route pages, services, guards, interceptors, models, and utilities; colocated `*.spec.ts` tests.
- `src/project/`: edition configuration and styles; `src/theme/`: shared styles; `src/locale/`: translations.
- `src/server.ts` and `src/ssr/`: Express SSR entry and request adapters.
- `public/`: static assets; root `prebuild-*.js` and `scripts/`: generators/checks; `dist/app/`: build output.

## Architecture & Configuration

Preserve standalone, zoneless Angular, standalone Ionic imports, and the integrated `@angular/build:application`/`AngularNodeAppEngine` build. Register icons centrally in `src/ionicons-polyfill.ts`; keep client hydration disabled. Edit canonical `src/app/app.routes.ts`; regenerate ignored artifacts with `npm run generate-routes`. Keep secrets out of configuration and environment files.

## Commands

Use Node/npm versions declared in `package.json`.

- `npm ci`: install locked dependencies.
- `npm start`: generate routes and serve Swedish development SSR on port 4200; `npm run start:fi` serves Finnish.
- `npm run build:ssr`: generate routes and build production browser/server bundles.
- `npm run serve:ssr`: serve compiled SSR on port 4201.
- `npm test`: watch unit tests; `npm run test:ci`: run once.
- `npm run test:source-encoding`: check source encoding.

## Coding Style

Follow `.editorconfig`: UTF-8, two-space indentation, final newlines, and single quotes in TypeScript. Use braces for `if` blocks; one-line blocks are allowed only for `return` statements. Use kebab-case filenames, PascalCase classes/interfaces, established Angular suffixes, and existing path aliases.

## Testing

Angular CLI runs Vitest with jsdom. Add focused regression coverage for behavior changes and run `test:ci` before PRs. Run route-recognition specs for route changes, `test:routes-parser` for generator changes, and `test:static-collection-menus` for menu generation changes. For SSR changes, build, run `test:build-output`, start `serve:ssr`, then run `test:ssr:smoke`.

## Commits & Pull Requests

Prefer focused Conventional Commits. PRs should explain behavior, rationale, configuration/deployment impact, and verification; include screenshots for UI changes. Update relevant docs and `CHANGELOG.md` for user-visible or operational changes. Leave published changelog entries unchanged.
