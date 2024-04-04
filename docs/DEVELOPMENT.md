# Development

This document contains notes and tips on the development of the app.


## Run locally on Windows

### Remote Docker image of app

To locally run a prebuilt Docker image, which has been pushed to an image repository like GitHub Packages or DockerHub:

1. Start [Docker Desktop][docker_desktop] and log in with your credentials.
2. In PowerShell, `cd` into the app repository folder.
3. Run `docker run -it -p 4201:4201 --rm <image-url>` where `<image-url>` must be replaced with the URL to the remote image, for example `ghcr.io/slsfi/digital-edition-frontend-ng:main`.
4. Open your browser on http://localhost:4201/.

### Local Docker image of app

To first build and then run a Docker image of a local copy of the repository on your own machine:

1. Start [Docker Desktop][docker_desktop] and log in with your credentials.
2. In PowerShell, `cd` into the app repository folder.
3. Run `docker build --no-cache -t name:tag .` (notice the dot at the end) to build the image from the current directory, where `name:tag` must be replaced with the name and tag of the image, for example `digital-edition-frontend-ng:latest`.
4. Run `docker run -it -p 4201:4201 --rm name:tag` where `name:tag` must be replaced with the name and tag of the image that you specified in step 3.
5. Open your browser on http://localhost:4201/.

### nginx in front of app image

In production, nginx is run in a Docker container in front of the app container so nginx, which is more performant than Node.js, can server static files. To run the app in this setup locally:

1. Start [Docker Desktop][docker_desktop] and log in with your credentials.
2. In PowerShell, `cd` into the app repository folder.
3. Run `docker build --no-cache -t name:tag .` (notice the dot at the end) to build the image from the current directory, where `name:tag` must be replaced with the name and tag of the image, for example `digital-edition-frontend-ng:latest`.
4. Replace the URL of `image` in the `web` service in [`compose.yml`][docker_compose_file] with the `name:tag` you chose for the Docker image in step 3. **Do not commit this change!**
5. Run `docker compose up -d`.
6. Open your browser on http://localhost:2089/ (the port of the nginx service defined in [`compose.yml`][docker_compose_file]).
7. Undo the changes in [`compose.yml`][docker_compose_file].
8. When you are done testing, stop the Docker containers in Docker Desktop and delete all containers and volumes that were created. Alternatively you can do this in the terminal by running `docker compose down --volumes`.


## Node.js version and building using GitHub Actions

The Node.js Docker-image tag can be passed as a build argument to `Dockerfile` using the argument `NODE_IMAGE_TAG`. `Dockerfile` sets a default value for the argument if it is not passed.

By default the app is built using GitHub Actions according to the workflow defined in `.github/workflows/docker-build-and-push.yml`, but you can also define your own build workflow. The Node.js image which is used as the base image for the build is defined in the workflow YAML-file and passed to `Dockerfile`.

When updating which Node.js image is used for the build, remember to update both `docker-build-and-push.yml` and `Dockerfile`.


## Dependencies

The app is built on Angular and uses many web components from Ionic. It also has a few other essential dependencies, which are briefly described below.


### `@angular`

The Angular documentation is available on https://angular.dev/.

#### Updating Angular

Run `ng update @angular/cli @angular/core`.

For more detailed instructions see https://angular.dev/cli/update.

When updating to a new major version of Angular:

1. See the interactive [Angular update guide][angular_update_guide].
2. Update the line in [`Dockerfile`][dockerfile] which indicates the Angular major version number: `ARG ANGULAR_MAJOR_VERSION=<major_version>`.


### `@ionic`

The Ionic Framework documentation is available on https://ionicframework.com/docs/

#### Updating Ionic

Run `npm install @ionic/angular @ionic/angular-server`.


### [`epubjs`][npm_epubjs]

Library for rendering ePub documents in the browser, used by the `epub-viewer` component in the app. It is poorly documented and not actively maintained anymore. It works without problems only in Firefox.


### [`express`][npm_express]

Framework for running a web server in Node.js. This library is required by Angular to enable server-side rendering.


### [`htmlparser2`][npm_htmlparser2]

SSR-compatible HTML/XML parser, used in a few places in the app to parse HTML from the backend.


### [`ionicons`][npm_ionicons]

Iconset especially intended to be used with Ionic.


### [`marked`][npm_marked]

SSR-compatible markdown parser. Parses markdown to HTML. Any HTML in the markdown is passed through as it is.


### [`rxjs`][npm_rxjs]

Reactive extensions library. Used internally by Angular and heavily in the app for handling Observables.


### [`tslib`][npm_tslib]

Runtime library for TypeScript containing all of the TypeScript helper functions. Required by Angular.


### [`zone.js`][npm_zone.js]

Library for execution contexts (”zones”) that persist across async tasks. Required by Angular.


### [`browser-sync`][npm_browser-sync] (devDependency)

Required by the Angular builders.


### [`copyfiles`][npm_copyfiles] (devDependency)

Library for copying files. Used by the `build:ssr` script in `package.json` to copy the `proxy-server.js` file into the `dist/app` folder once the Angular app has been built.


### [`gzipper`][npm_gzipper] (devDependency)

Library for compressing files. Used in `Dockerfile` in a post-build step to create compressed (gzip) versions of static files. It’s configured in the `compress` script in `package.json`.


### [`ng-extract-i18n-merge`][npm_ng-extract-i18n-merge] (devDependency)

Library for extracting and merging i18n xliff translation files for Angular projects. This library extends the default Angular CLI, and is used to sort the keys in the xliff translation files. Used when running the `extract-i18n` script in `package.json` to create the xliff translation files for the app.


### `jasmine` and `karma`

Testing frameworks.


[angular_update_guide]: https://update.angular.io/
[docker_compose_file]: ../compose.yml
[docker_desktop]: https://www.docker.com/products/docker-desktop/
[dockerfile]: ../Dockerfile
[npm_epubjs]: https://www.npmjs.com/package/epubjs
[npm_express]: https://www.npmjs.com/package/express
[npm_htmlparser2]: https://www.npmjs.com/package/htmlparser2
[npm_ionicons]: https://www.npmjs.com/package/ionicons
[npm_marked]: https://www.npmjs.com/package/marked
[npm_rxjs]: https://www.npmjs.com/package/rxjs
[npm_tslib]: https://www.npmjs.com/package/tslib
[npm_zone.js]: https://www.npmjs.com/package/zone.js
[npm_browser-sync]: https://www.npmjs.com/package/browser-sync
[npm_copyfiles]: https://www.npmjs.com/package/copyfiles
[npm_gzipper]: https://www.npmjs.com/package/gzipper
[npm_ng-extract-i18n-merge]: https://www.npmjs.com/package/ng-extract-i18n-merge
