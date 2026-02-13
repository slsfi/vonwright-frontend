# Development

This document contains notes and tips on the development of the app.


## Run locally on Windows

### Remote Docker image of app

To locally run a prebuilt Docker image, which has been pushed to an image repository like GitHub Packages or DockerHub:

1. Start [Docker Desktop][docker_desktop] and log in with your credentials.
2. In PowerShell, `cd` into the app repository folder.
3. Run

```bash
docker run -it -p 4201:4201 --rm ghcr.io/slsfi/digital-edition-frontend-ng:main
```

where you should replace `ghcr.io/slsfi/digital-edition-frontend-ng:main` with the URL to the remote image you want to run.

4. Open your browser on <http://localhost:4201/>.

### Local Docker image of app

To first build and then run a Docker image of a local copy of the repository on your own machine:

1. Start [Docker Desktop][docker_desktop] and log in with your credentials.
2. In PowerShell, `cd` into the app repository folder.
3. Run

```bash
docker build -t digital-edition-frontend-ng:test .
```

(notice the dot at the end) to build the image from the current directory, where `digital-edition-frontend-ng:test` is the name and tag of the image. You can choose a different name and tag if you wish. Add `--no-cache` only when troubleshooting or when you want to force a fully fresh build.

4. Run

```bash
docker run -it -p 4201:4201 --rm digital-edition-frontend-ng:test
```

to run the image. If you built the image with a different name and tag in step 3, replace `digital-edition-frontend-ng:test` with your chosen `name:tag`.

5. Open your browser on <http://localhost:4201/>.

### nginx in front of app image

In production, nginx is run in a Docker container in front of the app container so nginx, which is more performant than Node.js, can server static files. To run the app in this setup locally:

1. Start [Docker Desktop][docker_desktop] and log in with your credentials.
2. In PowerShell, `cd` into the app repository folder.
3. Run

```bash
docker build -t digital-edition-frontend-ng:test .
```

(notice the dot at the end) to build the image from the current directory, where `digital-edition-frontend-ng:test` is the name and tag of the image. You can choose a different name and tag if you wish. Add `--no-cache` only when troubleshooting or when you want to force a fully fresh build.

4. Replace the URL of `image` in the `web` service in [`compose.yml`][docker_compose_file] with `digital-edition-frontend-ng:test` (or the `name:tag` you built the image with in step 3). **Do not commit this change!**
5. Run

```bash
docker compose up -d
```

6. Open your browser on <http://localhost:2089/> (the port of the nginx service defined in [`compose.yml`][docker_compose_file]).
7. Undo the changes in [`compose.yml`][docker_compose_file].
8. When you are done testing, stop the Docker containers in Docker Desktop and delete all containers and volumes that were created. Alternatively you can do this in the terminal by running

```bash
docker compose down --volumes
```


## Node.js version and building using GitHub Actions

The Node.js Docker-image tag can be passed as a build argument to `Dockerfile` using the argument `NODE_IMAGE_TAG`. `Dockerfile` sets a default value for the argument if it is not passed.

By default the app is built using GitHub Actions according to the workflow defined in `.github/workflows/docker-build-and-push.yml`, but you can also define your own build workflow. The workflow uses Docker Buildx (BuildKit) through `docker/build-push-action`, passes `NODE_IMAGE_TAG` to `Dockerfile`, and sets `pull: true` for the build step so base image layers are refreshed by the builder.

The workflow also runs `docker pull node:${NODE_IMAGE_TAG}` before the build. This is intentional for explicitness and log visibility.

When updating which Node.js image is used for the build, remember to update both `docker-build-and-push.yml` and `Dockerfile`.


## Dependencies

The app is built on Angular and uses many web components from Ionic. It also has a few other essential dependencies, which are briefly described below.


### `@angular`

The Angular documentation is available on <https://angular.dev/>.

At it’s root, the Angular app uses NgModules, even though all components except `pages` use the standalone API. This is because currently, another dependency, `Ionic`, doesn’t support the Angular standalone API for SSR apps.

#### Updating Angular

Run

```bash
ng update @angular/cli @angular/core
```

For more detailed instructions see <https://angular.dev/cli/update>.

When updating to a new major version of Angular:

1. See the interactive [Angular update guide][angular_update_guide].
2. Update Angular dependencies in `package.json`/`package-lock.json` (for example via `ng update`). The Docker build installs dependencies from the lockfile using `npm ci`, so there is no separate Angular version argument in [`Dockerfile`][dockerfile] to update.


### `@ionic`

The Ionic Framework documentation is available on <https://ionicframework.com/docs/>

#### Updating Ionic

Run

```bash
npm install @ionic/angular @ionic/angular-server
```


### [`express`][npm_express]

Framework for running a web server in Node.js. This library is required by Angular to enable server-side rendering.


### [`htmlparser2`][npm_htmlparser2]

SSR-compatible HTML/XML parser, used in a few places in the app to parse HTML from the backend.


### [`ionicons`][npm_ionicons]

Iconset especially intended to be used with Ionic.


### [`marked`][npm_marked]

SSR-compatible Markdown parser. Parses Markdown to HTML. Any HTML in the Markdown is passed through as it is.


### [`marked-custom-heading-id`][npm_marked-custom-heading-id]

An extension to `marked` supporting adding custom ids to headings in the [Markdown Extended Syntax](https://www.markdownguide.org/extended-syntax/#heading-ids): `# heading {#custom-id}`.


### [`marked-footnote`][npm_marked-footnote]

An extension to `marked` supporting [GFM footnotes](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#footnotes) in Markdown.


### [`rxjs`][npm_rxjs]

Reactive extensions library. Used internally by Angular and heavily in the app for handling Observables.


### [`tslib`][npm_tslib]

Runtime library for TypeScript containing all of the TypeScript helper functions. Required by Angular.


### [`zone.js`][npm_zone.js]

Library for execution contexts (”zones”) that persist across async tasks. Required by Angular.


### [`browser-sync`][npm_browser-sync] (devDependency)

Required by the Angular builders.


### [`gzipper`][npm_gzipper] (devDependency)

Library for compressing files. Used in `Dockerfile` in a post-build step to create compressed (gzip) versions of static files. It’s configured in the `compress` script in `package.json`.


### [`ng-extract-i18n-merge`][npm_ng-extract-i18n-merge] (devDependency)

Library for extracting and merging i18n xliff translation files for Angular projects. This library extends the default Angular CLI, and is used to sort the keys in the xliff translation files. Used when running the `extract-i18n` script in `package.json` to create the xliff translation files for the app.


### `jasmine` and `karma`

Angular testing frameworks, not in use.


[angular_update_guide]: https://update.angular.io/
[docker_compose_file]: ../compose.yml
[docker_desktop]: https://www.docker.com/products/docker-desktop/
[dockerfile]: ../Dockerfile
[npm_epubjs]: https://www.npmjs.com/package/epubjs
[npm_express]: https://www.npmjs.com/package/express
[npm_htmlparser2]: https://www.npmjs.com/package/htmlparser2
[npm_ionicons]: https://www.npmjs.com/package/ionicons
[npm_marked]: https://www.npmjs.com/package/marked
[npm_marked-custom-heading-id]: https://www.npmjs.com/package/marked-custom-heading-id
[npm_marked-footnote]: https://www.npmjs.com/package/marked-footnote
[npm_rxjs]: https://www.npmjs.com/package/rxjs
[npm_tslib]: https://www.npmjs.com/package/tslib
[npm_zone.js]: https://www.npmjs.com/package/zone.js
[npm_browser-sync]: https://www.npmjs.com/package/browser-sync
[npm_gzipper]: https://www.npmjs.com/package/gzipper
[npm_ng-extract-i18n-merge]: https://www.npmjs.com/package/ng-extract-i18n-merge
