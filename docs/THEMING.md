# Theming

This app is intended to be themed in each project fork. Keep fork-specific
changes concentrated in the files described below so that updates from the
base repository remain easy to merge.


## Where theming changes belong

Use the following files for different kinds of customization:

- [`src/assets/custom_css/custom.scss`](../src/assets/custom_css/custom.scss)
  for colors, typography, spacing, component variables, and other
  project-specific CSS. This is the preferred place for most theming work.
- [`src/global.scss`](../src/global.scss) for choosing which shared style and
  font bundles are included in the build.
- [`src/assets/config/config.ts`](../src/assets/config/config.ts) for visual
  options represented by application configuration, such as the home-page
  banner.
- [`src/index.html`](../src/index.html) for external font-provider snippets and
  other document-level resources.
- `src/assets/images/` and `src/assets/icon/` for project images and icons.

The Angular build loads `global.scss` first and `custom.scss` second. As a
result, declarations in `custom.scss` can override the base styles without
editing them. Prefer this approach over changing styles in `src/theme/` or in
individual components: it keeps the fork's theme in one place and reduces
merge conflicts when the base app is updated.


## Customize CSS variables

[`custom.scss`](../src/assets/custom_css/custom.scss) starts with a commented
reference containing the global and component-scoped CSS custom properties
used by the app, their default values, and the selectors required to override
them. Use that reference as the source of truth when building a theme.

Global variables belong in `:root`. For example:

```scss
:root {
  --primary-color: #281f47;
  --primary-color-rgb: 40, 31, 71;
  --primary-color-contrast: #fff;
  --default-link-color: #174ea6;
  --main-background-color: #f5f2ec;
  --font-stack-app-base: "Inter", var(--font-stack-system);
  --font-stack-tei: "SourceSerif", Georgia, serif;
}
```

Keep related values consistent. In particular, update the RGB form of a color
when changing its solid form because translucent Ionic styles use the RGB
value.

Scoped variables must be placed on the page or component selector shown in
the reference. For example:

```scss
page-home {
  --banner-height: 55%;
  --banner-title-color: #fff;
  --banner-title-text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
  --text-content-max-width: 52rem;
}

page-introduction[class][class] {
  --intro-toc-background-color: #281f47;
  --intro-toc-text-color: #fff;
}
```

Some scoped defaults are declared in `src/theme/scoped-variables/` and need
the `[class][class]` specificity shown above. Other variables use inline
fallbacks and can be overridden with the element selector alone. Follow the
selector listed in `custom.scss`; use `!important` only when a more specific
selector is not practical.

You can also add ordinary SCSS rules to `custom.scss` when no custom property
exists. Prefer a narrow page or component selector so that the rule does not
unintentionally affect another feature. When a broadly useful design value is
missing, consider adding a reusable custom property to the base app instead
of duplicating component overrides across forks.


## Select global style bundles

[`global.scss`](../src/global.scss) is the entry point for the app's shared
styles. A fork can comment out optional `meta.load-css()` calls that it does
not use. Do not remove Ionic's core, normalize, structure, or typography CSS;
Ionic components depend on those styles.

### Bundled fonts

The app includes four local font families: Roboto, Source Serif, Mulish, and
Inter. Comment out the font-face includes for unused families:

```scss
@include meta.load-css("theme/font-face/roboto");
@include meta.load-css("theme/font-face/source-serif");
// @include meta.load-css("theme/font-face/mulish");
// @include meta.load-css("theme/font-face/inter");
```

Before removing a bundle, check the font-stack variables in `custom.scss` and
any project-specific styles. A family that is still named in a stack will
fall back to the next available font if its bundle is no longer loaded.

### TEI styles

Collection pages can use one of two TEI style sets:

- [`_inc-global-tei.scss`](../src/theme/_inc-global-tei.scss) contains the
  original TEI styles.
- [`_inc-global-tei-v2.scss`](../src/theme/_inc-global-tei-v2.scss) contains
  the newer styles and requires the corresponding v2 HTML structure.

Import only the version that matches the collection markup. If the fork has
no collection pages, both imports can be commented out. Do not select v2 only
for its appearance without first confirming that the rendered HTML uses the
structure expected by v2.

Within the selected TEI import file, comment out feature styles the fork does
not need. For example, a fork without manuscripts or variants can omit the
corresponding `tei-manuscripts` or `tei-variants` includes. Keep shared and
core TEI includes required by the features that remain.

### Optional collection styles

[`_inc-global-optional.scss`](../src/theme/_inc-global-optional.scss) provides
info-overlay and tooltip styles used by collection introductions and
collection texts. Its include in `global.scss` can be commented out when the
fork has no such content or tooltips.

After changing imports, test all enabled page types. Removing an include saves
CSS only when no active component or content depends on it.


## Use external web fonts

Fonts from providers such as Google Fonts or Adobe Fonts can be used instead
of, or alongside, the bundled fonts. Add the provider's HTML snippet to the
`<head>` of [`src/index.html`](../src/index.html), then reference the supplied
family name through variables in `custom.scss`:

```html
<!-- src/index.html -->
<link rel="stylesheet" href="https://example-font-provider.invalid/project.css">
```

```scss
/* src/assets/custom_css/custom.scss */
:root {
  --font-stack-app-base: "Project Sans", var(--font-stack-system);
  --font-stack-home-banner: "Project Display", var(--font-stack-app-base);
}
```

Replace the example URL and family names with the provider's actual values.
Remove unused local font includes from `global.scss` after the new stacks are
in place. Also consider the provider's licensing, privacy implications,
availability, and effect on page rendering. Self-hosting licensed font files
under `src/assets/fonts/` is preferable when the edition must work without a
third-party request.


## Configure images and project identity

The home-page banner is configured under `config.page.home.bannerImage` in
[`config.ts`](../src/assets/config/config.ts). The configuration supports the
image URL, localized alternative text, intrinsic dimensions, orientation, and
alternate sources. Related portrait layout options live under
`config.page.home.portraitOrientationSettings`. Store project images under
`src/assets/images/` and use an `assets/images/...` URL in the configuration.

Always provide meaningful alternative text in every enabled locale. When the
image has known intrinsic dimensions, configure them to reduce layout shifts.
Check both landscape and portrait layouts, including the narrow single-column
view, because they use different banner variables.

Other identity assets to review are:

- `config.app.openGraphMetaTags.image`, which supplies localized social-share
  images and alternative text;
- [`src/assets/icon/favicon.ico`](../src/assets/icon/favicon.ico), referenced
  by [`src/index.html`](../src/index.html);
- project-specific logos or decorative images under `src/assets/images/`.

Keep presentational choices in CSS where possible and use `config.ts` only for
options exposed by the application. Do not put secrets or environment
credentials in the configuration.


## Validate a theme

Run the app while developing:

```bash
npm start
```

Check at least the home page, menus, dialogs, enabled collection views, search
or index pages, and error/loading states. Test narrow and wide viewports,
keyboard focus, browser zoom, and every supported locale. Text and interactive
controls should retain sufficient contrast in normal, hover, focus, selected,
and disabled states.

Before releasing a theme, create the production SSR build:

```bash
npm run build:ssr
```

The production build catches missing Sass imports and asset paths that may not
be apparent while editing. If global source files were changed, also run:

```bash
npm run test:source-encoding
```
