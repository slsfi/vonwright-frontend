# Breaking changes for project forks

These documents describe the breaking changes introduced in each major release of the base app, along with merge considerations and validation steps for project forks. Each document assumes the fork is on the latest release of the previous major version. For example, the v4 notes assume the latest v3 release as their starting point.

## Available documents

| Document | Assumed baseline |
| --- | --- |
| [v4 breaking changes and fork migration notes](v4.md) | Latest v3 release. |
| [v3 breaking changes and fork migration notes](v3.md) | Latest v2 release. |
| [v2 breaking changes and fork migration notes](v2.md) | Latest v1 release. |

## Applying the changes

The [fork update workflow](../DEPLOYMENT.md#updating-from-the-base-app-digital-edition-frontend-ng) syncs with the base app's current `main` branch. The release and baseline define the scope of each document; they do not provide a way to select intermediate releases. For forks on older versions, also review earlier breaking changes in the [changelog](../../CHANGELOG.md) and any available documents when merging the current upstream changes.

When resolving conflicts, adopt upstream build/test changes while preserving the edition's settings, locales, translations, style selections, package identity, and deployment settings. Replacing a whole customized file with either side can lose edition settings or retain removed tooling.

The notes focus on the usual [project customization files](../PROJECT-CUSTOMIZATION.md#project-customization-files). Guidance for custom application code and tests applies only to forks that customized those areas.

The v2 and v3 documents also identify changes in later minor or patch releases that need review in customized forks. Their paths and commands describe the source at those releases; use the layout and tooling of the version actually being merged. Check each document's release-status notes and use the final release notes and tagged source when upgrading a production fork.

## Related documentation

- [Project customization](../PROJECT-CUSTOMIZATION.md): current edition settings, customization files, and fork setup.
- [Updating, building and deployment](../DEPLOYMENT.md): routine upstream updates, releases, deployment, and rollback.
- [Changelog](../../CHANGELOG.md): changes included in each release.
- [Migration plans](../migrations/README.md): implementation plans and history for changes in the base app.
