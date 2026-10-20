# Migration plans

This directory contains implementation plans and records for migrations in the base app. Current architecture and operating guidance live in [development](../DEVELOPMENT.md) and [deployment](../DEPLOYMENT.md); release-specific instructions for fork maintainers live in [breaking changes and fork migration notes](../breaking-changes/).

## Active and planned migrations

No active or planned migration plans are currently recorded here. Deferred work is tracked in the [cross-cutting TODOs](../TODO.md).

## Completed migrations

| Migration | Scope | Release |
| --- | --- | --- |
| [Angular 22 modernization](completed/angular-22-modernization/README.md) | Standalone and zoneless application, integrated application builder and SSR, Vitest, and public asset layout. | Stage 1: 3.1.0. Stage 2: planned for 4.0.0. |

## Organizing migration plans

Give each migration its own named folder directly under `migrations/`, with a `README.md` overview and additional stage plans when needed. When implementation and verification are complete, move the whole folder under `completed/` and update this index and incoming links. Completion records implementation status; it does not mean the changes have been released.
