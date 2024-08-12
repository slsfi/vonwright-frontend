# Production frontend of Den okände von Wright, vonwright.sls.fi

This branch contains the production frontend app of the digital edition Den okände von Wright, [https://vonwright.sls.fi/][vonwright.sls.fi]. It is based on [`digital-edition-frontend-ng`][digital-edition-frontend-ng], the frontend app of the [SLS][SLS] platform for building digital edition web apps.

The app is built on [Angular][angular] and uses [Ionic][ionic] web components.

<p>
  <a href="https://github.com/angular/angular"><img alt="Angular version badge" src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fslsfi%2Fdigital-edition-frontend-ng%2Fmain%2Fpackage-lock.json&query=%24%5B'packages'%5D%5B'node_modules%2F%40angular%2Fcore'%5D%5B'version'%5D&prefix=v&logo=angular&logoColor=%23fff&label=Angular&color=%23dd0031"></a>
  &nbsp;
  <a href="https://github.com/ionic-team/ionic-framework"><img alt="Ionic version badge" src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fslsfi%2Fdigital-edition-frontend-ng%2Fmain%2Fpackage-lock.json&query=%24%5B'packages'%5D%5B'node_modules%2F%40ionic%2Fcore'%5D%5B'version'%5D&prefix=v&logo=ionic&logoColor=%23fff&label=Ionic&color=%23176bff"></a>
</p>

<hr>


## Changelog

[Learn about the latest improvements][changelog].


## Documentation

- [Updating, building and deployment](docs/DEPLOYMENT.md).
- [Development notes](docs/DEVELOPMENT.md).


## Development Setup

### Prerequisites

1. Install [Node.js][node.js] which includes [npm][npm]. The app is compatible with Node `^18.19.1`, `^20.11.1` and `^22.0.0`. The app is currently configured to run on Node `20`. Check your Node version with:

```
Node --version
```

2. Install the [Angular CLI][angular_cli] globally:

```
npm install -g @angular/cli
```

3. [Clone][clone_repository] the repository locally and `cd` into the folder. On Windows you can use [GitHub Desktop][github_desktop] or [Git Bash][git_bash] (see [tutorial on Git Bash][gith_bash_tutorial]).

4. Install dependencies:

```
npm install
```

### Running locally

#### Development Server

To build and serve the application on a development server as a client-side app only, run:

```
npm run start
```

Open your browser on http://localhost:4200/. The app will automatically rebuild and reload if you change any of the source files.

#### Server-Side Rendered App

To build the server-side rendered application, run:

```
npm run build:ssr
```

Then, to serve the app, run:

```
npm run serve:ssr
```

Open your browser on http://localhost:4201/. You need to manually run the build and serve commands again for changes in the source files to take effect.


## About the SLS Digital Edition Platform

The platform consists of an [Angular frontend app][digital-edition-frontend-ng], a [Flask-driven REST API][digital_edition_api], a [backend search app][digital_edition_search] run by the Elastic (ELK) Stack, a [template for a backend files repository][digital_edition_required_files_template] and a [database template][digital_edition_db]. There is also a [tool for creating commentaries][digital_edition_commentary] to texts in [TEI-XML][TEI] format.


[angular]: https://angular.io/
[angular_cli]: https://angular.io/cli
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
[vonwright.sls.fi]: https://vonwright.sls.fi/
