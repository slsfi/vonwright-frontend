# Updating, building and deployment


## Prerequisites

Set up a forked repository for your app according to the instructions for [setting up a new project][set_up_project]. These instructions apply to forked repositories and use `production` for the public edition branch in examples. A fork can also maintain `development` or `staging` branches for internal versions. Apply the update, release, and deployment steps separately to each maintained edition branch, substituting its name wherever an example uses `production`.

Use the [project customization guide](PROJECT-CUSTOMIZATION.md) to configure edition features, assets, languages, and styling before building. This guide covers updating, releasing, and operating the configured fork.


## Updating from the base app, [digital-edition-frontend-ng][digital-edition-frontend-ng]

1. Switch to the `base` branch.
2. Select `Sync fork` to update the `base` branch with the latest changes from the original, upstream repository [digital-edition-frontend-ng][digital-edition-frontend-ng].
3. Merge the changes from the `base` branch into each maintained edition branch, such as `production`, `development`, or `staging`, and resolve any conflicts for that branch.

It’s recommended not to synchronise unreleased changes from the upstream repository, but to wait for them to be included in a release. The base app uses semantic versioning.

Before merging a new major release, review its [breaking changes and fork migration notes](breaking-changes/README.md), then use these general build and deployment instructions.


## Building

A GitHub Actions [workflow][build_workflow] for automated builds is included in the repository. It automatically builds and pushes a new [Docker image][docker_image_reference] of the app on pushes to `main`, when a GitHub Release is published, and when started manually from the **Actions** tab. Releases and prereleases both build on publication; a pushed Git tag is built when its GitHub Release is published. When creating a new release tag, name the tag based on the version of the base app and append it with a branch identifier and an incremental build number.

Release builds use the workflow, Dockerfile, and edition configuration at the tagged commit, whether the tag was created from `production`, `development`, or `staging`. Keep the workflow current in each release branch. The explicit `main` push filter does not restrict release builds to a particular branch.

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

The shared Docker base stage runs `apk upgrade --no-cache` to apply available package updates from the configured Alpine release repositories before installing npm dependencies. These updates reach both the build stages and the final runtime image. Node.js itself is supplied by the Node base image and is refreshed by pulling a newer base image. The same step prints `node --version` and `npm --version`; expand **Build and push Docker image** in the GitHub Actions job log to find the versions used by every stage.

The supplied GitHub Actions workflow uses `pull: true` and does not configure a persistent Docker build cache, so each job refreshes the base image and executes the package-upgrade step. For a local security rebuild, use `docker build --pull --no-cache -t <image>:<tag> .` to refresh the base image and force all build steps to execute; APK's `--no-cache` option only controls its package cache.

**Important!** Before creating a new release, push a commit that updates:

1. the image tag in [`compose.yml`][docker_compose_file] to the release tag you are going to use,
2. the version property in [`package.json`][package_json] and [`package-lock.json`][package-lock_json] with the release tag (recommended: run `npm version --no-git-tag-version <release-tag>` so both files are updated without changing dependency versions),
3. the [changelog][changelog].

If you edit `package.json` manually instead, run `npm install --package-lock-only` to synchronize lockfile metadata. Avoid using plain `npm install` just to update the lockfile, unless you intentionally want dependency resolution changes.

### Rebuild an existing release image

The **Run workflow** form includes an optional **Release tag to rebuild** field. Actions must be enabled, and the build workflow must be present on the repository's default branch for the form to be available.

To refresh an existing release, of any age, without creating a new Git tag or changing the npm version:

1. Open the fork's **Actions** tab on github.com and select **Build and push Docker image**.
2. Choose **Run workflow**.
3. Under **Use workflow from**, select the repository's default branch, for example `production`.
4. In **Release tag to rebuild**, enter the existing tag, for example `4.0.0-production.1`.
5. Choose **Run workflow** to start a new run.

The selected branch supplies the workflow definition; the release-tag field selects the application source and can refer to a tag from any edition branch. The workflow validates the tag, checks out that exact Git tag, and publishes its Docker image tag with the correct source-commit label. Leaving the field empty builds the selected branch's current source and publishes its branch image tag.

This starts a separate manual run, so GitHub's 30-day limit on [rerunning an existing run](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs) does not apply. Use this form for maintenance rebuilds. **Re-run all jobs** reuses the workflow definition from the original run and can therefore apply different build or tagging rules.

For example, rebuilding `4.0.0-production.1` pulls the current Node base image and republishes `ghcr.io/OWNER/FORK:4.0.0-production.1`. The Git tag continues to identify the same source commit, while the Docker image tag can point to a new image digest. Record the old and new image digests for traceability and rollback; an image pinned by digest must be updated explicitly. The build also regenerates any enabled sitemap and static menus from current backend content, so rebuilding the same source can refresh those assets.

The rebuild uses the Dockerfile and application source from the selected release tag. To include subsequent source changes, create a new release.

After a successful rebuild, follow the [deployment procedure](#deploy-or-update-the-image), including recreating the browser-static volume, even when the image tag text has not changed.

### The latest image tag

GitHub's **Latest** release designation and Docker's `latest` image tag are separate settings. The supplied workflow disables the metadata action's automatic `latest` tagging and explicitly connects the image alias to [GitHub's current latest published release](https://docs.github.com/en/rest/releases/releases#get-the-latest-release).

Every build publishes its branch or release image tag first. After building, a separate step queries GitHub and publishes `latest` from that build's image digest only if its source tag matches the currently designated latest release. Branch builds, older releases, prereleases, and tags without a matching latest GitHub Release leave the existing alias unchanged. A GitHub API error fails this step without moving the alias; a repository with no published latest release also leaves it unchanged.

When publishing a release, select **Set as the latest release** only for the release intended to supply the Docker `latest` alias. If you change the latest designation on an already published release, use the manual rebuild form for that tag to update the alias. The same procedure corrects an alias that points to the wrong image: rebuild the release currently designated as latest. Deploy using the intended release tag or recorded digest.


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
