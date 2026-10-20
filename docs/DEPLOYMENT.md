# Updating, building and deployment


## Prerequisites

Set up a forked repository for your app according to the instructions for [setting up a new project][set_up_project]. These instructions only apply to forked repositories, and assume that it is the `production` branch which is to be updated, built and deployed. However, the same instructions apply to any other branch, for instance a `dev` branch, – just exchange any mentions of `production` with the target branch name.

Use the [project customization guide](PROJECT-CUSTOMIZATION.md) to configure edition features, assets, languages, and styling before building. This guide covers updating, releasing, and operating the configured fork.


## Updating from the base app, [digital-edition-frontend-ng][digital-edition-frontend-ng]

1. Switch to the `base` branch.
2. Select `Sync fork` to update the `base` branch with the latest changes from the original, upstream repository [digital-edition-frontend-ng][digital-edition-frontend-ng].
3. Merge the changes from the `base` branch to the `production` branch and resolve any conflicts.

It’s recommended not to synchronise unreleased changes from the upstream repository, but to wait for them to be included in a release. The base app uses semantic versioning.

Before merging a new major release, review its [breaking changes and fork migration notes](breaking-changes/README.md), then use these general build and deployment instructions.


## Building

A GitHub Actions [workflow][build_workflow] for automated builds is included in the repository. It automatically builds and pushes a new [Docker image][docker_image_reference] of the app on pushes to `main`, on pushed tags, and when manually triggered (`workflow_dispatch`). When creating a new release tag, name the tag based on the version of the base app and append it with a branch identifier and an incremental build number.

For example, if the base app is on version `1.0.2`, the release targets the `production` branch and this is the first build for this version in the `production` branch, the release should be tagged `1.0.2-production.1`. The next release should be tagged `1.0.2-production.2` (build number incremented by 1), provided that the base app remains on `1.0.2` and the release targets the `production` branch. When the semantic version of the base app changes, the build number is reset to 1, for instance: `1.1.0-production.1`.

The Docker images built this way are pushed to and stored in the [GitHub Container Registry][ghcr_docs].

The production build command `npm run build:ssr` runs route generation and one integrated `@angular/build:application` build for the browser and server. Route filtering follows the settings described in [project customization](PROJECT-CUSTOMIZATION.md#feature-based-route-generation).

The integrated application build emits browser files under `dist/app/browser/<locale subPath>` and the ESM runtime at `dist/app/server/server.mjs`. `npm run serve:ssr` starts it on port 4201 (or `PORT`). Browser CSR shells are named `index.csr.html`. Docker and benchmarks use the canonical npm command; emitted locales and their URL subpaths are configured in `angular.json`.

| Production output | Purpose |
| --- | --- |
| `dist/app/server/server.mjs` | Express entry with Angular's localized application dispatch. |
| `dist/app/server/<locale subPath>/main.server.mjs` and adjacent chunks/manifests | Localized Angular server application and its runtime dependencies. |
| `dist/app/browser/<locale subPath>/index.csr.html` | Client-rendered shell used for auth-protected routes when auth is enabled. |
| `dist/app/browser/<locale subPath>/` | Browser bundles, compiled `media/` resources, and copied public files (`assets/`, `static-html/`, favicon, robots, and sitemap). |

`<locale subPath>` is Angular's configured output/URL subpath, which can differ from the locale code. The base emits Swedish and Finnish; `aa` is the technical source locale, not a production output. Angular uses runtime SSR for public routes, with critical CSS inlining and client hydration disabled. Generated static collection menus are independent of Angular prerendering.

The [`Dockerfile`][dockerfile] installs from the lockfile with `npm ci`, generates the sitemap/static menus, builds both applications, and compresses browser output. The final image contains production dependencies and runs the SSR entry as a non-root user. Local `build:ssr` does not run the sitemap/menu generators or compression; invoke those commands separately when validating the complete deployment output locally.

**Important!** Before creating a new release, push a commit that updates:

1. the image tag in [`compose.yml`][docker_compose_file] to the release tag you are going to use,
2. the version property in [`package.json`][package_json] and [`package-lock.json`][package-lock_json] with the release tag (recommended: run `npm version --no-git-tag-version <release-tag>` so both files are updated without changing dependency versions),
3. the [changelog][changelog].

If you edit `package.json` manually instead, run `npm install --package-lock-only` to synchronize lockfile metadata. Avoid using plain `npm install` just to update the lockfile, unless you intentionally want dependency resolution changes.


## Deployment

Use [Docker Compose][docker_compose_reference] and the supplied [`compose.yml`][docker_compose_file] to deploy the fork's published image with nginx in front of the Node SSR server. The app container starts through `npm run serve:ssr`. A standalone app container can also be started with [`docker run`][docker_run_reference].

Before deploying, configure the edition's [Compose image and port](PROJECT-CUSTOMIZATION.md#docker-compose), [nginx settings](PROJECT-CUSTOMIZATION.md#nginx-configuration), and [SSR proxy trust](PROJECT-CUSTOMIZATION.md#ssr-and-proxy-settings). The [development notes](DEVELOPMENT.md#nginx-in-production) explain static serving, caching, compression, and the SSR request path.

### Deploy or update the image

On the deployment server, run these commands from the directory containing the fork's `compose.yml` and `nginx.conf` for an initial deployment:

```bash
docker compose pull
docker compose up -d
```

**Important!** When deploying an updated image, recreate the shared browser-static [Docker volume][docker_volume_reference] as well. Its contents persist across container replacements and are not refreshed by pulling a new image. Otherwise, nginx can serve browser files from the previous build while Node runs the new server build.

```bash
docker compose pull && docker compose down --volumes && docker compose up -d
```

This stops the deployment and removes its containers and volumes before recreating them from the selected image. Use the same procedure when rolling back to an earlier image.

After starting the containers, check the edition's locale-prefixed and unprefixed pages, static assets, root `/robots.txt` and `/sitemap.txt`, and any enabled authentication flow. Confirm that canonical and Open Graph URLs use the public site origin. See [edition validation](PROJECT-CUSTOMIZATION.md#validate-and-deploy-the-edition) for the checks to prepare before rollout.

### Runtime environment settings

The web container accepts these environment variables. Set overrides through its Compose `environment` settings and recreate the app container to apply them:

- `SSR_RATE_LIMIT_WINDOW_MS` (default: `60000`): length of the dynamic-render rate-limit window in milliseconds.
- `SSR_RATE_LIMIT_LIMIT` (default: `1200`): maximum dynamic-render requests per resolved client IP during one window. Requests above the limit receive HTTP `429` until the window resets.
- `NG_ALLOWED_HOSTS`: comma-separated additional hostnames accepted by Angular SSR. Loopback hosts and the hostname from `app.siteURLOrigin` are already allowed.

The limiter uses the client IP resolved through the edition's [SSR proxy settings](PROJECT-CUSTOMIZATION.md#ssr-and-proxy-settings). Static-file requests and probes bypass the SSR limiter.


## Roll-back to earlier version

In case the deployed app needs to be rolled back to an earlier version, push a commit that updates:

1. the image tag in [`compose.yml`][docker_compose_file] to the tag of the selected previous release,
2. the [changelog][changelog] with information about the roll-back under the ”Unreleased” section.

Then redeploy the app.

**Important!** Do not create a new release when rolling back to an earlier version.



[build_workflow]: ../.github/workflows/docker-build-and-push.yml
[changelog]: ../CHANGELOG.md
[digital-edition-frontend-ng]: https://github.com/slsfi/digital-edition-frontend-ng
[docker_compose_file]: ../compose.yml
[docker_compose_reference]: https://docs.docker.com/compose/
[docker_image_reference]: https://docs.docker.com/build/building/packaging/
[docker_run_reference]: https://docs.docker.com/engine/reference/run/
[docker_volume_reference]: https://docs.docker.com/storage/volumes/
[dockerfile]: ../Dockerfile
[ghcr_docs]: https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry
[package_json]: ../package.json
[package-lock_json]: ../package-lock.json
[set_up_project]: https://github.com/slsfi/digital-edition-frontend-ng#setting-up-a-project
