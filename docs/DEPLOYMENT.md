# Updating, building and deployment


## Prerequisites

Set up a forked repository for your app according to the instructions for [setting up a new project][set_up_project]. These instructions only apply to forked repositories, and assume that it is the `production` branch which is to be updated, built and deployed. However, the same instructions apply to any other branch, for instance a `dev` branch, – just exchange any mentions of `production` with the target branch name.


## Updating from the base app, [digital-edition-frontend-ng][digital-edition-frontend-ng]

1. Switch to the `base` branch.
2. Select `Sync fork` to update the `base` branch with the latest changes from the original, upstream repository [digital-edition-frontend-ng][digital-edition-frontend-ng].
3. Merge the changes from the `base` branch to the `production` branch and resolve any conflicts.

It’s recommended not to synchronise unreleased changes from the upstream repository, but to wait for them to be included in a release. The base app uses semantic versioning.


## Building

A GitHub Actions [workflow][build_workflow] for automated builds is included in the repository. It automatically builds and pushes a new [Docker image][docker_image_reference] of the app on pushes to `main`, on pushed tags, and when manually triggered (`workflow_dispatch`). When creating a new release tag, name the tag based on the version of the base app and append it with a branch identifier and an incremental build number.

For example, if the base app is on version `1.0.2`, the release targets the `production` branch and this is the first build for this version in the `production` branch, the release should be tagged `1.0.2-production.1`. The next release should be tagged `1.0.2-production.2` (build number incremented by 1), provided that the base app remains on `1.0.2` and the release targets the `production` branch. When the semantic version of the base app changes, the build number is reset to 1, for instance: `1.1.0-production.1`.

The Docker images built this way are pushed to and stored in the [GitHub Container Registry][ghcr_docs].

The production build command `npm run build:ssr` runs route generation before compiling Angular. Feature-based route/module exclusion is disabled by default and can be enabled in [`src/assets/config/config.ts`][config_ts] by setting `app.prebuild.featureBasedRoutes` to `true`.

**Important!** Before creating a new release, push a commit that updates:

1. the image tag in [`compose.yml`][docker_compose_file] to the release tag you are going to use,
2. the version property in [`package.json`][package_json] and [`package-lock.json`][package-lock_json] with the release tag (recommended: run `npm version --no-git-tag-version <release-tag>` so both files are updated without changing dependency versions),
3. the [changelog][changelog].

If you edit `package.json` manually instead, run `npm install --package-lock-only` to synchronize lockfile metadata. Avoid using plain `npm install` just to update the lockfile, unless you intentionally want dependency resolution changes.


## Deployment

You can start a Docker container of the app from an image created in the step above by using the [`docker run`][docker_run_reference] command.

However, for easier configuration and better performance it is recommended to use [Docker Compose][docker_compose_reference] and the provided Compose file [`compose.yml`][docker_compose_file]. The Compose file defines an [nginx][nginx] web server to be used for serving static files in front of Node ([`nginx.conf`][nginx_conf]). This increases performance.

The Node SSR app uses app-level request limiting for dynamic render requests. Limits can be tuned with environment variables (or by modifying in [`server.ts`](../server.ts)):

- `SSR_RATE_LIMIT_WINDOW_MS` (default: `60000`): length of one rate-limit window in milliseconds (60 seconds by default).
- `SSR_RATE_LIMIT_LIMIT` (default: `1200`): maximum number of dynamic render requests allowed per resolved request IP (`req.ip`) during one window (default: 1200 requests per 60 seconds, after which requests are answered with HTTP `429` until the window resets).

The request IP used by the limiter depends on Express proxy trust settings. Configure this in [`src/assets/config/config.ts`][config_ts]:

- `app.ssr.trustProxyHops` (default: `2`): number of trusted proxy hops when resolving `req.ip` for SSR rate limiting. Value `2` is correct when the app runs behind one upstream reverse proxy (for example HAProxy) in front of nginx (`reverse proxy -> nginx -> Node/Express SSR app`). If the app is reached directly through nginx (no extra reverse proxy), set this to `1`. If the app is reached directly by Node/Express (no proxy), set this to `0`. If the proxy chain is longer, increase the value accordingly.

**Important!** nginx gets access to the static files through a [Docker volume][docker_volume_reference], which is defined in [`compose.yml`][docker_compose_file]. Since volumes persist even if the container itself is deleted, and the content of a volume is not updated when the image is updated, you need to run

```
docker compose pull && docker compose down --volumes && docker compose up -d
```

when you wish to redeploy the app with an updated image. This removes all existing containers and volumes before recreating the app.


## Roll-back to earlier version

In case the deployed app needs to be rolled back to an earlier version, push a commit that updates:

1. the image tag in [`compose.yml`][docker_compose_file] to the tag of the selected previous release,
2. the [changelog][changelog] with information about the roll-back under the ”Unreleased” section.

Then redeploy the app.

**Important!** Do not create a new release when rolling back to an earlier version.



[build_workflow]: ../.github/workflows/docker-build-and-push.yml
[changelog]: ../CHANGELOG.md
[config_ts]: ../src/assets/config/config.ts
[digital-edition-frontend-ng]: https://github.com/slsfi/digital-edition-frontend-ng
[docker_compose_file]: ../compose.yml
[docker_compose_reference]: https://docs.docker.com/compose/
[docker_image_reference]: https://docs.docker.com/build/building/packaging/
[docker_run_reference]: https://docs.docker.com/engine/reference/run/
[docker_volume_reference]: https://docs.docker.com/storage/volumes/
[dockerfile]: ../Dockerfile
[ghcr_docs]: https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry
[nginx]: https://www.nginx.com/
[nginx_conf]: ../nginx.conf
[package_json]: ../package.json
[package-lock_json]: ../package-lock.json
[set_up_project]: https://github.com/slsfi/digital-edition-frontend-ng#setting-up-a-project
