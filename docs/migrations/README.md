# Angular modernization migrations

These plans document a two-stage effort to bring the application from an Angular 20-era architecture that still used legacy and deprecated Angular APIs to a modern Angular 22 architecture. The work is split into stages so the application can remain runnable throughout the modernization and the higher-risk build, SSR, and test-runner changes can be handled separately.

| Stage | Status | Scope | Plan |
| --- | --- | --- | --- |
| 1 | Completed for release 3.1.0 | Migrate the application and Ionic integration to standalone APIs and remove Zone.js-dependent change detection while retaining the existing build, SSR, test, and deployment architecture. | [Standalone and zoneless migration](STAGE-1-STANDALONE-ZONELESS.md) |
| 2 | Planned; not yet implemented | Migrate from the legacy Webpack browser/server builders and `CommonEngine` to Angular's `application` builder and current SSR APIs, then replace Jasmine/Karma with Vitest. | [Application builder and Vitest migration](STAGE-2-APPLICATION-BUILDER.md) |

See the [application architecture](../DEVELOPMENT.md#application-architecture) for the current implemented state. Active deferred work remains tracked in the [cross-cutting TODOs](../TODO.md).
