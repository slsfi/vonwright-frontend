# Production frontend of Den okände von Wright, vonwright.sls.fi

This branch contains the production frontend app of the digital edition Den okände von Wright, <https://vonwright.sls.fi/>. It is based on [`digital-edition-frontend-ng`][digital-edition-frontend-ng], the frontend app of the [SLS][SLS] platform for building digital edition web apps.

The app is built on [Angular][angular] and uses [Ionic][ionic] web components.

<p>
  <a href="https://github.com/angular/angular"><img alt="Angular version badge" src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fslsfi%2Fvonwright-frontend%2Fproduction%2Fpackage-lock.json&query=%24%5B'packages'%5D%5B'node_modules%2F%40angular%2Fcore'%5D%5B'version'%5D&prefix=v&logo=angular&logoColor=%23fff&label=Angular%20Core&color=%23dd0031"></a>
  &nbsp;
  <a href="https://github.com/ionic-team/ionic-framework"><img alt="Ionic version badge" src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fslsfi%2Fvonwright-frontend%2Fproduction%2Fpackage-lock.json&query=%24%5B'packages'%5D%5B'node_modules%2F%40ionic%2Fcore'%5D%5B'version'%5D&prefix=v&logo=ionic&logoColor=%23fff&label=Ionic&color=%23176bff"></a>
</p>

<hr>


## Changelog

[Learn about the latest improvements][changelog].


## Documentation

- [Project customization](docs/PROJECT-CUSTOMIZATION.md).
- [Updating, building and deployment](docs/DEPLOYMENT.md).
- [Base-app development](docs/DEVELOPMENT.md).
- [Breaking changes for project forks](docs/breaking-changes/README.md).


## Development Setup

### Prerequisites

1. Install [Node.js][node.js] which includes [npm][npm]. The app requires Node `^24.15.0` and npm `>=11.16.0`; Docker and CI are configured to use Node `24`. Check both versions with:

```
node --version
npm --version
```

2. [Clone][clone_repository] the repository locally and `cd` into the folder. On Windows you can use [GitHub Desktop][github_desktop] or [Git Bash][git_bash] (see [tutorial on Git Bash][gith_bash_tutorial]).

3. Install project dependencies:

```
npm install
```

The local Angular CLI from `node_modules` is used by the npm scripts.

### Running locally

#### Development Server

To generate route metadata and serve the Swedish application with development SSR and automatic source updates, run:

```
npm run start
```

Open your browser on http://localhost:4200/. Use `npm run start:fi` for Finnish. Each development server serves one locale at `/`; production serves the configured locale prefixes. Template and component/global style edits use hot updates where supported, while other source edits reload the page. See [development-server behavior](docs/DEVELOPMENT.md#angular-development-server).

#### Production Server-Side Rendered App

To generate route metadata and build the production browser and server bundles for the configured locales, run:

```
npm run build:ssr
```

Then, to start the built production SSR server, run:

```
npm run serve:ssr
```

Open your browser on http://localhost:4201/. This server runs the compiled output from `dist/app/`. After changing source files, stop the server, rebuild, and start it again for the changes to take effect.

See [building and deployment](docs/DEPLOYMENT.md#building) for the localized output layout and Docker/nginx workflow.

### Testing

Run `npm test` for unit tests in interactive watch mode, or `npm run test:ci` for a single run before a PR or in CI. Angular uses Vitest with jsdom; the unit suite does not require Chrome. See [testing](docs/DEVELOPMENT.md#testing) for script-based route, SSR, and output checks.


## About the SLS Digital Edition Platform

The platform consists of an [Angular frontend app][digital-edition-frontend-ng], a [Flask-driven REST API][digital_edition_api], a [backend search app][digital_edition_search] run by the Elastic (ELK) Stack, a [template for a backend files repository][digital_edition_required_files_template] and a [database template][digital_edition_db]. There is also a [tool for creating commentaries][digital_edition_commentary] to texts in [TEI-XML][TEI] format.


[angular]: https://angular.dev/
[angular_cli]: https://angular.dev/cli
[changelog]: CHANGELOG.md
[clone_repository]: https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository
[digital-edition-frontend-ng]: https://github.com/slsfi/digital-edition-frontend-ng
[digital_edition_api]: https://github.com/slsfi/digital_edition_api
[digital_edition_commentary]: https://github.com/slsfi/digital_edition_commentary
[digital_edition_db]: https://github.com/slsfi/digital_edition_db
[digital_edition_required_files_template]: https://github.com/slsfi/digital_edition_required_files_template
[digital_edition_search]: https://github.com/slsfi/digital_edition_search
[git_bash]: https://gitforwindows.org/
[gith_bash_tutorial]: https://www.atlassian.com/git/tutorials/git-bash
[github_desktop]: https://desktop.github.com/
[ionic]: https://ionicframework.com/
[node.js]: https://nodejs.org/
[npm]: https://www.npmjs.com/get-npm
[SLS]: https://www.sls.fi/en
[TEI]: https://tei-c.org/
