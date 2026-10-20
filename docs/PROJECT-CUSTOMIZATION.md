# Project customization

This guide is for maintainers configuring an edition fork of the base app. Start with the [project setup steps](../README.md#setting-up-a-project), then configure the fork on GitHub before adapting the edition's files and settings. Keep edition-specific settings, styles, and assets concentrated in these locations so updates from the base repository remain easier to merge.

The [base-app development notes](DEVELOPMENT.md) cover architecture, implementation, dependency maintenance, and developer testing. This guide covers the customization workflow; the [project configuration reference](CONFIGURATION.md) describes the types, possible values, and behavior of the options in `src/project/config.ts`. When upgrading an existing fork between major versions of the base app, review the relevant [breaking changes and fork migration notes](breaking-changes/README.md).

## Set up the fork on GitHub

After creating the fork and its branches using the [README steps](../README.md#setting-up-a-project), configure the forked repository on GitHub. The examples below use `base` for the upstream mirror and `production` for the edition branch; substitute the names chosen for the fork. Make edition-specific file changes on the production branch through pull requests, keeping the base branch available only for upstream syncing.

### Default branch

In repository **Settings**, change **Default branch** to `production`. Both branches should still share the same unmodified upstream starting point at this stage. Set the default before adding the rulesets below so **Include default branch** protects the edition branch. This makes the edition branch the default view of the repository and the usual target for pull requests. See [GitHub's default-branch instructions](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-branches-in-your-repository/changing-the-default-branch).

For later upstream updates, select `base` explicitly when syncing the fork, then merge the updated base into `production` through a pull request. Making `production` the default does not change the upstream mirror's role.

### Branch rulesets

Open **Settings → Rules → Rulesets**, choose **New branch ruleset**, and create the two rulesets below with enforcement set to **Active**. Use the actual upstream-mirror branch name in the first ruleset and **Include default branch** in the second. GitHub documents [ruleset creation and bypass roles](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository) and the [available branch rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets).

#### Lock base branch, allow syncing

| Setting | Value |
| --- | --- |
| Ruleset name | `Lock base branch, allow syncing` |
| Bypass list | None. |
| Target branches | Include by pattern: `base`. |
| Restrict updates | Enabled, with **Allow fork syncing** selected. |
| Restrict deletions | Enabled. |
| Block force pushes | Enabled. |

This keeps manual edition changes out of the upstream mirror while allowing GitHub's fork-sync operation.

#### Require pull request before merging to default branch

| Setting | Value |
| --- | --- |
| Ruleset name | `Require pull request before merging to default branch` |
| Bypass list | Organization admin and repository admin. |
| Target branches | Include default branch. |
| Restrict deletions | Enabled. |
| Require a pull request before merging | Enabled. |
| Required approvals | `1`. |
| Dismiss stale pull request approvals when new commits are pushed | Enabled. |
| Block force pushes | Enabled. |

The admin bypass entries allow exceptions to these rules. Keep routine edition changes on the pull-request workflow.

### Repository About

On the repository home page, edit **About** using its settings button. Set an edition-specific description and website address, and clear **Deployments** under the home-page inclusions.

### GitHub Actions

Open the fork's **Actions** tab and enable workflow runs when GitHub prompts for confirmation. If an individual workflow is disabled, select it and choose **Enable workflow**; see [GitHub's workflow instructions](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows).

Review [`.github/workflows/docker-build-and-push.yml`](../.github/workflows/docker-build-and-push.yml) in the production branch. The supplied workflow builds on pushes to `main`, pushed tags, and manual dispatch. Changing the default branch does not change its explicit `main` push filter: use the edition branch if automatic production-branch builds are wanted. Its image name is derived from the GitHub repository, so align the image/tag in `compose.yml` with the fork's published image. Release/build procedures are documented in [deployment](DEPLOYMENT.md#building).

## Project customization files

Keep a fork's settings and styles in `src/project/`, and its static files in `public/`. The usual customization points are:

| Location | What a project fork changes |
| --- | --- |
| [`angular.json`](../angular.json) | Configure the edition's build locales. |
| [`compose.yml`](../compose.yml) | Select the fork's published image/tag and an available host port for nginx on the deployment server. |
| [`nginx.conf`](../nginx.conf) | Set the default locale, optional compression of SSR HTML, and proxy buffers for the edition's response sizes. |
| [`package.json`](../package.json) | Set the edition's package name, version, description, homepage, and development start scripts for its locales. Keep lockfile metadata synchronized. |
| [`README.md`](../README.md) | Describe the forked edition project, its website, maintainers, and project-specific setup. Replace the base-app introduction and examples. |
| `public/assets/{images,files,ebooks,fonts}/` | Add or replace public edition assets. Keep URLs such as `assets/images/...` in configuration and templates. |
| [`public/favicon.ico`](../public/favicon.ico) | Replace the favicon. The former `assets/icon/favicon.ico` URL remains available as a build-time alias. |
| [`public/robots.txt`](../public/robots.txt) | Set edition-specific production crawler instructions and the sitemap URL; it is served at `/robots.txt`. |
| [`src/index.html`](../src/index.html) | Document-level resources, such as external font-provider snippets. |
| [`src/locale/`](../src/locale/) (`messages.<locale>.xlf`) | Edit translations for enabled locales, including `Site.Title`, `Site.Subtitle`, and `Site.MetaDescription.Home`. |
| [`src/project/config.ts`](../src/project/config.ts) | Edition settings, enabled features, menus, authentication, SSR options, and public/backend origins. Application imports continue to use `@config`; see the [configuration reference](CONFIGURATION.md). |
| [`src/project/global-overrides.scss`](../src/project/global-overrides.scss) | Additional global styles and overrides to base CSS variables and page/component styles. Loaded after the base styles; see the [theming guide](THEMING.md). |
| [`src/styles.scss`](../src/styles.scss) | Comment out unused shared style/font bundles. |
| [`src/theme/_inc-global-tei.scss`](../src/theme/_inc-global-tei.scss) | Select the TEI feature styles required by the edition; see [theming](THEMING.md#tei-styles) for the alternate v2 entry. |

`public/sitemap.txt` and `public/static-html/collection-toc/` are generator outputs. Their generation is described [below](#generated-public-content).

## Edition settings and content

Review [`src/project/config.ts`](../src/project/config.ts) before running the edition. The base configuration contains example project data; replace it with the fork's own identifiers, content, and URLs. See the [configuration reference](CONFIGURATION.md) for all options, their types, and possible values.

| Configuration area | What to review |
| --- | --- |
| `app.projectNameDB` and `app.projectId` | The edition's backend project identifiers. |
| `app.backendBaseURL` | The digital edition API used for content requests. |
| `app.siteURLOrigin` | The public site origin used for generated URLs and SSR metadata. Use the deployed public origin, including its intended HTTP/HTTPS scheme. |
| `app.i18n` | Interface languages, default language, and multilingual backend-content settings; see [internationalization](#internationalization). |
| `app.ssr` | SSR behavior and trusted proxies; see [SSR and proxy settings](#ssr-and-proxy-settings). |
| `collections`, `articles`, and `ebooks` | Collection selection/order, article entries, ebook files, and related content settings. |
| `page`, `component`, and `modal` | Page behavior, navigation, content views, search options, and dialogs. |
| `app.openGraphMetaTags` and `page.home` | Social-share images, the home-page banner, and localized image descriptions. |

Configuration is compiled into the app; rebuild the production output after changing it. It is not a runtime environment file. Do not put secrets or credentials in it. Backend content, search indices, and file endpoints must correspond to the configured edition; a frontend setting does not provision those services.

### Internationalization

Choose the edition's interface languages and default language early in setup. The base app builds Swedish (`sv`) and Finnish (`fi`), with Swedish as the default. Its English translation file is maintained but is not included in the default build. The technical source locale `aa` lets every public language use a translation file; keep it when changing the edition's languages.

#### Select or add languages

Keep the application settings, build locales, translations, and development launchers aligned:

1. **In `src/project/config.ts`**:

    - Set `app.i18n.languages` to the edition's language entries, each with a `code`, display `label`, and appropriate `region`.
    - Set `app.i18n.defaultLanguage` to one of those codes. A single-language edition uses one entry.

2. **In `angular.json`**:

    - Include each maintained translation filename, such as `messages.en.xlf`, in `projects.app.architect.extract-i18n.options.targetFiles`.
    - Run `npm run extract-i18n` to create missing files and merge current messages into existing ones under `src/locale/`. Translate and review them as described [below](#translate-interface-messages).
    - Add each public language under `projects.app.i18n.locales`, with its `translation` file path and `subPath`. For English, use `src/locale/messages.en.xlf` and `en`. Use the language code as the URL subpath so it matches the app's language links.
    - Set `projects.app.architect.build.options.localize` to the emitted language codes, for example `["en"]` for an English-only edition. Include the configured default language in that list.
    - Add a single-locale configuration under `projects.app.architect.build.configurations` for each development language. An `en` entry uses `"localize": ["en"]`. Add its matching entry under `projects.app.architect.serve.configurations`, with `"buildTarget": "app:build:development,en"`.

3. **In `package.json`**:

    - Update the `start` and `start:<locale>` scripts to use those development configurations, keeping the matching route-generation hooks. See [package identity and start scripts](#package-identity-and-start-scripts) for the launcher example.

4. **In `nginx.conf`**:

    - Set `$default_locale` to the language code of the default language, for example `set $default_locale en;` for an English default. nginx does not read `config.ts`; keep these settings aligned. See [nginx configuration](#nginx-configuration).

To remove a public language, remove it from the app's language list, Angular's build locales and `localize` list, and its development configurations and launchers. Change the default language if needed. Remove its extraction `targetFiles` entry only if the fork will stop maintaining that translation; maintaining a file does not require emitting that locale.

Development serves one locale at `/`. Production serves the emitted locale subpaths and uses `app.i18n.defaultLanguage` for unprefixed requests. After changing languages, regenerate any enabled [public content](#generated-public-content), rebuild, and check each locale's pages and language-switch links, plus the default language at an unprefixed URL. Follow [deployment](DEPLOYMENT.md#deployment) for rollout.

#### Translate interface messages

Run `npm run extract-i18n` after merging base-app changes or adding application messages. It extracts the shared source messages and merges them into the files listed in `targetFiles`, retaining existing targets and sorting units by ID. It does not translate the text. Review the diff for new or changed messages, obsolete units, and edition-specific targets before committing.

Edit `<target>` values in `src/locale/messages.<locale>.xlf`. Preserve unit IDs, interpolation placeholders, inline markup, and plural/select expressions. Do not edit the generated `src/locale/messages.xlf` source catalog or shared template source text to customize an edition. Check translations in the running locale; a successful build does not prove they are complete, because the base build ignores missing translations and can display source text instead.

#### Edition title, subtitle, and description

In each enabled language's translation file, replace at least these targets:

| Translation ID | Edition value |
| --- | --- |
| `Site.Title` | The website/edition title. |
| `Site.Subtitle` | The subtitle, or an empty translation when the edition has no subtitle. |
| `Site.MetaDescription.Home` | A localized description of the edition for home-page metadata. |

For an edition without a subtitle, keep an empty target rather than removing the translation unit. Update these values in every enabled locale and review the other project-specific targets.

#### Localized configuration and backend content

Translations cover interface text. Also provide values for every enabled language in localized configuration in `src/project/config.ts`, such as `app.openGraphMetaTags.image` and `page.home.bannerImage.altTexts`. For localized `articles`, use the matching `language` code and the same article `id` across language variants; `routeName` can differ by language so the language switch leads to the corresponding article.

Configure multilingual backend content under `app.i18n` according to what the edition's API actually provides:

| Setting | Content requirement |
| --- | --- |
| `multilingualCollectionTableOfContents` | Enable when the backend provides localized collection metadata and tables of contents for the interface languages. |
| `multilingualReadingTextLanguages` | List the language codes of the reading-text versions available from the backend. These describe content languages and need not be identical to the interface-language list. |
| `multilingualNamedEntityData` | Enable when the backend provides localized named-entity details for the interface languages. |

Adding an interface locale does not translate backend articles, collection front matter, reading texts, or named entities. Supply the corresponding backend content and check its availability when switching languages.

### Navigation and enabled features

In `src/project/config.ts`, use `component.mainSideMenu.items` to select the main navigation items, and `component.topMenu` to select the top-menu buttons. Review the corresponding content settings as well: for example, articles need entries in `articles`, ebooks need entries in `ebooks`, and collections use `collections.order`. Collection front-matter views are selected with `collections.frontMatterPages`.

With feature-based route filtering disabled, hiding a menu item changes navigation but leaves its route available. Use [feature-based route generation](#feature-based-route-generation) to omit supported inactive production routes, and [authentication](#authentication) when content requires access control.

### Feature-based route generation

In `src/project/config.ts`, `app.prebuild.featureBasedRoutes` defaults to `false`. In that mode, generated production routes retain the canonical route set. Set it to `true` to filter supported top-level routes according to the edition's feature/content settings.

The filtering rules use menu flags and related content settings. For example, the ebook route requires both `component.mainSideMenu.items.ebooks` and at least one `ebooks` entry; search remains included when either its side-menu item or the top-menu search button is enabled. Custom top-level routes without a filtering rule remain included. Route filtering is not an authorization mechanism.

`npm run build:ssr` generates the route artifacts before building. During development, the browser uses the canonical routes, so check the production build to verify that inactive routes were omitted. `npm start` and `npm run start:fi` generate server-rendering metadata before serving; after changing feature/auth configuration while a server is running, run `npm run generate-routes` and restart the development server. Generate routes first when invoking Angular build/serve commands directly.

The generated route files are build outputs. Do not edit them to customize the edition. Changes to route declarations or to the filtering rules are source development, documented in [route-generation internals](DEVELOPMENT.md#feature-based-route-generation).

## Repository files and deployment settings

### Edition README

The fork's root [`README.md`](../README.md) should describe the edition rather than present itself as the shared base app. Include the edition's name and purpose, public website, maintainers/contact information, and any edition-specific setup or development notes. Retain useful links to the shared guides under `docs/` and identify the upstream base repository so future maintainers know where updates come from.

### Package identity and start scripts

Update `name`, `description`, and `homepage` in [`package.json`](../package.json) for the edition. Set `version` according to the edition's release/build naming described in [deployment](DEPLOYMENT.md#building). Keep `package-lock.json` in sync: use `npm version --no-git-tag-version <release-tag>` for release versions, or `npm install --package-lock-only` after changing package identity metadata.

Adjust the development `start` scripts to the locales/configurations selected in [internationalization](#internationalization). Keep the route-generation lifecycle hook paired with every start script. For example, if the fork defines an `en` build configuration, its default launcher can be:

```json
"prestart": "npm run generate-routes",
"start": "ng serve --configuration=development,en"
```

Likewise, each additional `start:<locale>` script needs a matching `prestart:<locale>` hook. Remove launchers for locales the fork does not use. Keep the supported Node/npm declarations and shared build, test, and runtime scripts when changing package identity or language launchers.

### Docker Compose

In [`compose.yml`](../compose.yml), set `services.web.image` to the fork's published image and chosen tag. Set `services.nginx.ports` to an available host port on the deployment server, using `<available-host-port>:80`. The left-hand port is the server port allocated to this edition; the right-hand port remains nginx's container port. Coordinate that host port with the upstream reverse proxy's routing to the edition. See [deployment](DEPLOYMENT.md#deployment) for image rollout and browser-volume handling.

### SSR and proxy settings

Review these options in [`src/project/config.ts`](../src/project/config.ts) against the edition's deployed proxy chain:

- `app.ssr.trustProxyHops` (default: `2`): maximum number of trusted proxy hops when resolving the client IP for SSR rate limiting. Use `2` for `HAProxy -> nginx -> Node`, `1` for `nginx -> Node`, and `0` when clients connect directly to Node. Adjust the value if the proxy chain is longer.
- `app.ssr.trustedProxyAddresses` (default: `["loopback", "linklocal", "uniquelocal"]`): trusted proxy IPs/subnets, using Express's named ranges, individual addresses, or CIDRs. Set this to the actual trusted proxy addresses; include public proxy IPs explicitly when needed. Both the hop limit and address list apply to the forwarded client-IP chain. An empty address list or zero hops disables proxy trust.

The immediate proxy connecting to Node must be trusted for Node to accept `X-Forwarded-Host` and `X-Forwarded-Proto`. Trusted upstream proxies must overwrite client-supplied origin headers before forwarding requests. Check that rendered canonical and Open Graph URLs use the edition's public `app.siteURLOrigin`, including its intended HTTPS scheme.

Runtime rate-limit overrides and additional SSR hostnames are documented under [deployment environment settings](DEPLOYMENT.md#runtime-environment-settings). The [development notes](DEVELOPMENT.md#ssr-request-handling) explain how the server applies proxy trust.

### nginx configuration

[`nginx.conf`](../nginx.conf) controls static-file serving and the proxy to the Node SSR server. Compose mounts it into the nginx container. Review the following settings for the edition, and validate changes with `docker compose exec nginx nginx -t` before reloading or restarting nginx. See [nginx in production](DEVELOPMENT.md#nginx-in-production) for the architecture and [deployment](DEPLOYMENT.md#deployment) for rollout procedures.

#### Default locale

Set `$default_locale` to the emitted subpath of the edition's configured default language. For example:

```nginx
set $default_locale en;
```

nginx uses this value to find unprefixed static files and root `/robots.txt` and `/sitemap.txt` in the default locale's browser directory. It must agree with `app.i18n.defaultLanguage` in `src/project/config.ts` and the locale's `subPath` in `angular.json`; see [internationalization](#internationalization).

#### Compression

The base configuration enables `gzip_static on` to serve precompressed `.gz` files created by `npm run compress`; Docker runs that command after building. This does not compress dynamic SSR responses. See [nginx's precompressed-file documentation](https://nginx.org/en/docs/http/ngx_http_gzip_static_module.html).

To compress rendered HTML as nginx sends it, enable `gzip` and start with compression level `1` in the `server` block. Add `gzip_vary on` so caches distinguish responses by accepted encoding:

```nginx
gzip on;
gzip_comp_level 1;
gzip_vary on;
```

This reduces transferred HTML at the cost of compression work in nginx. HTML is included automatically; `gzip_types` is used to add other response types. The existing `gzip_proxied` setting limits compression when an upstream proxy sends a `Via` request header; review its conditions for the deployment, or use `gzip_proxied any` to allow all such requests. See the [nginx gzip directives](https://nginx.org/en/docs/http/ngx_http_gzip_module.html).

Check that a large SSR page returns `Content-Encoding: gzip` through the production proxy chain when the client accepts gzip.

#### Proxy buffers for large SSR responses

The `location @backend` block supplies these defaults:

| Directive | Purpose |
| --- | --- |
| `proxy_buffers 24 16k;` | Response-body buffers per proxied connection, with a configured capacity of 384 KiB. |
| `proxy_buffer_size 16k;` | Buffer for the first part of the upstream response, usually its HTTP headers. |

With response buffering enabled, nginx can write data that exceeds the in-memory buffers to temporary files. These sizes do not cap the size of an SSR response. Increasing `proxy_buffers` can reduce disk buffering for large HTML pages, but increases potential memory use across concurrent requests. Increase `proxy_buffer_size` when headers need more space, rather than solely because the HTML body is large. See the [nginx proxy-buffer documentation](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_buffering).

The [Topelius fork](https://github.com/slsfi/topelius-frontend/blob/production/nginx.conf) uses `proxy_buffers 32 16k;` (512 KiB) and retains `proxy_buffer_size 16k;`. Choose values based on the edition's response sizes, nginx logs, and expected concurrency.

## Public assets and crawler documents

Add edition files under `public/assets/` and reference their public URL rather than their source location. For example, `public/assets/images/banner.jpg` is referenced as `assets/images/banner.jpg`, not `public/assets/images/banner.jpg`. Angular copies public files into each emitted locale's browser output. Locale-prefixed asset requests use that locale's copy; unprefixed requests use the configured default locale.

Replace [`public/favicon.ico`](../public/favicon.ico) for the edition's favicon. Both the current `favicon.ico` URL and the compatibility `assets/icon/favicon.ico` URL are emitted from that file. Font selection and source references are covered in the [theming guide](THEMING.md).

Edit [`public/robots.txt`](../public/robots.txt) when crawler rules need to differ for the edition. The deployed crawler documents are available at the website root as `/robots.txt` and `/sitemap.txt`, independent of the locale prefixes used by application pages. See the [default-locale nginx setting](#default-locale) for serving these files.

### Production crawler instructions

Apply edition-specific changes to `public/robots.txt` only in the fork's production branch. Keep the upstream-mirror branch unchanged. A typical production file includes a crawl-delay request and the edition's absolute sitemap URL:

```text
User-agent: *
Crawl-delay: 10

Sitemap: https://edition.example.org/sitemap.txt
```

Replace the example origin with the edition's public origin and retain any edition-specific `Disallow` rules. `Crawl-delay` depends on crawler support; Google does not support it. The sitemap URL must include the scheme and host. See [Google's robots.txt reference](https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec). The production-only convention is managed through branches; the build copies the `public/robots.txt` present in the branch being built.

### Generated public content

These options in `src/project/config.ts` control sitemap and static collection menu generation:

| Setting | Command | Output |
| --- | --- | --- |
| `app.prebuild.sitemap` | `npm run generate-sitemap` | `public/sitemap.txt`, containing page URLs for the configured default language. |
| `app.prebuild.staticCollectionMenus` | `npm run generate-static-collection-menus` | Locale-specific collection TOC fragments under `public/static-html/collection-toc/`. |

Run the generators before building when their corresponding flags are enabled. Docker invokes both generators automatically; a local `npm run build:ssr` does not. Collection-menu generation is skipped when authentication is enabled or `app.ssr.collectionSideMenu` renders the menu dynamically. The generators fetch edition content from the configured backend, so that backend must be reachable when generation runs.

Regenerate these files after changing relevant content, languages, or configuration. Generated collection menus are ignored by Git. If generation is disabled or skipped, review existing output rather than assuming it was removed: files left in `public/` are still copied by the build. For protected content, follow the [authentication guide](AUTHENTICATION.md#static-collection-menus-in-auth-mode) when reviewing static menus.

## Theming

Use the [theming guide](THEMING.md) for CSS variables, global overrides, style/font bundle selection, TEI styles, external fonts, images, and theme validation. Keep most edition-specific styles in `src/project/global-overrides.scss`; the detailed styling instructions belong in that guide.

## Authentication

Authentication is optional and disabled in the base configuration. Follow the [authentication guide](AUTHENTICATION.md) to enable it in a fork, configure backend endpoints, protect the intended routes, and validate login/session behavior. That guide also covers the consequences for SSR, sitemaps, and static collection menus.

## Validate and deploy the edition

Use the [README's local setup](../README.md#development-setup) to install dependencies and preview changes. Check the edition's enabled page types, navigation, images/downloads, languages, and responsive theme. Configuration and asset changes also need a production build: development serves one locale and does not apply production route filtering.

Generate the required public content, then run `npm run build:ssr` and `npm run serve:ssr`. Check locale-prefixed and unprefixed URLs, root crawler documents, and any protected routes. The base SSR smoke fixtures use base-app content; use a cases file for the edition's routes and expected content as described in the [smoke-test reference](DEVELOPMENT.md#ssr-smoke-test-local-or-remote).

Use [updating, building and deployment](DEPLOYMENT.md) for releases, rollout, runtime environment settings, and rollback. Use [breaking changes and fork migration notes](breaking-changes/README.md) for changes between major base-app releases.
