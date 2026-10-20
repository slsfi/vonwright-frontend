# Angular 22 modernization migrations

These plans document a two-stage effort to bring the application from an Angular 20-era architecture that still used legacy and deprecated Angular APIs to a modern Angular 22 architecture. The work is split into stages so the application can remain runnable throughout the modernization and the higher-risk build, SSR, and test-runner changes can be handled separately.

Both stages are complete. This folder retains their implementation and validation history; see the [migration index](../../README.md) for other migrations.

| Stage | Status | Scope | Plan |
| --- | --- | --- | --- |
| 1 | Completed for release 3.1.0 | Migrate the application and Ionic integration to standalone APIs and remove Zone.js-dependent change detection while retaining the existing build, SSR, test, and deployment architecture. | [Standalone and zoneless migration](STAGE-1-STANDALONE-ZONELESS.md) |
| 2 | Completed; planned for release 4.0.0 | Integrated application builder and `AngularNodeAppEngine`, generated SSR/CSR routes, Vitest with jsdom, and the public asset/fork customization layout. Route/auth/test/browser and deployment gates pass; measured build/test durations and server output size improve. All 20 implementation and documentation checkpoints are complete. | [Application builder and Vitest migration](STAGE-2-APPLICATION-BUILDER.md) |

See the [application architecture](../../../DEVELOPMENT.md#application-architecture) for the current implemented state. Active deferred work remains tracked in the [cross-cutting TODOs](../../../TODO.md).

These plans record implementation work in the base app. Fork maintainers upgrading releases should use the [v4 breaking changes and fork migration notes](../../../breaking-changes/v4.md).
