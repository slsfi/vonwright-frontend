# Updating, building and deployment


## Prerequisites

Set up a forked repository for your app according to the instructions for [setting up a new project][set_up_project]. These instructions only apply to forked repositories, and assume that it is the `production` branch which is to be updated, built and deployed. However, the same instructions apply to any other branch, for instance a `dev` branch, – just exchange any mentions of `production` with the target branch name.


## Updating from the base app, [digital-edition-frontend-ng][digital-edition-frontend-ng]

1. Switch to the `base` branch.
2. Select `Sync fork` to update the `base` branch with the latest changes from the original, upstream repository [digital-edition-frontend-ng][digital-edition-frontend-ng].
3. Merge the changes from the `base` branch to the `production` branch and resolve any conflicts.

It’s recommended not to synchronise unreleased changes from the upstream repository, but to wait for them to be included in a release. The base app uses semantic versioning.


## Building

A GitHub Actions [workflow][build_workflow] for automated builds is included in the repository. It will automatically build a new [Docker image][docker_image_reference] of the app on every new GitHub release in the repository and tag the Docker image with the release tag. When creating the new release, name the tag based on the version of the base app and append it with a branch identifier and an incremental build number.

For example, if the base app is on version `1.0.2`, the release targets the `production` branch and this is the first build for this version in the `production` branch, the release should be tagged `1.0.2-production.1`. The next release should be tagged `1.0.2-production.2` (build number incremented by 1), provided that the base app remains on `1.0.2` and the release targets the `production` branch. When the semantic version of the base app changes, the build number is reset to 1, for instance: `1.1.0-production.1`.

The Docker images built this way are pushed to and stored in the [GitHub Container Registry][ghcr_docs].

**Important!** Before creating a new release, push a commit that updates:

1. the image tag in [`compose.yml`][docker_compose_file] to the release tag you are going to use,
2. the version property in [`package.json`][package_json] with the release tag (run `npm install` so [`package-lock.json`][package-lock_json] also gets updated),
3. the [changelog][changelog].


## Deployment

You can starting a Docker container of the app from an image created in the step above by using the [`docker run`][docker_run_reference] command.

However, for easier configuration and better performance it is recommended you utilize [Docker Compose][docker_compose_reference] and the provided Compose file [`compose.yml`][docker_compose_file]. The Compose file defines an [nginx][nginx] web server to be used for serving static files in front of Node ([`nginx.conf`][nginx_conf]). This increases performance.

**Important!** nginx gets access to the static files through a [Docker volume][docker_volume_reference], which is defined in [`Dockerfile`][dockerfile]. Since volumes persist even if the container itself is deleted, and the content of a volume is not updated when the image is updated, you need to run

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


## Running Docker image locally for testing

a) To locally run a Docker image, which has been automatically built and pushed to GitHub according to the description above:

1. Start [Docker Desktop][docker_desktop] and log in.
2. `cd` into the app repository folder.
3. Run `docker run -it -p 4201:4201 --rm <image-url>` where `<image-url>` must be replaced with the URL to the image, for example `ghcr.io/slsfi/digital-edition-frontend-ng:main`.
4. Open your browser on http://localhost:4201/.

b) To first build and then run a Docker image of a local copy of the repository on your own machine:

1. Start [Docker Desktop][docker_desktop] and log in.
2. `cd` into the app repository folder.
3. Run `docker build --no-cache -t name:tag .` (notice the dot at the end) to build the image from the current directory, where `name:tag` must be replaced with the name and tag of the image, for example `digital-edition-frontend-ng:latest`.
4. Run `docker run -it -p 4201:4201 --rm name:tag` where `name:tag` must be replaced with the name and tag of the image that you specified in step 3.
5. Open your browser on http://localhost:4201/.

## Running Docker containers with nginx in front of app locally for testing

In production, nginx is run in a Docker container in front of the app container so nginx, which is more performant than Node.js, can server static files. To run the app in this setup locally for testing purposes:

1. Follow steps 1–3 under option b) in the previous section.
2. Replace `image` in the `web` service in [`compose.yml`][docker_compose_file] with the `name:tag` you chose for the Docker image in step 3 in option b) above. **Do not commit this change!**
3. Run `docker compose up -d`.
4. Open your browser on http://localhost:2089/ (the port of the nginx service defined in [`compose.yml`][docker_compose_file]).
5. Undo the changes in [`compose.yml`][docker_compose_file]).
6. When you are done testing, stop the Docker containers in Docker Desktop and delete all containers and volumes that were created. Alternatively you can do this in the terminal by running `docker compose down --volumes`.


[build_workflow]: ../.github/workflows/docker-build-and-push.yml
[changelog]: ../CHANGELOG.md
[digital-edition-frontend-ng]: https://github.com/slsfi/digital-edition-frontend-ng
[docker_compose_file]: ../compose.yml
[docker_compose_reference]: https://docs.docker.com/compose/
[docker_desktop]: https://www.docker.com/products/docker-desktop/
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
