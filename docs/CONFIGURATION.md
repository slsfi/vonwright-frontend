# Project configuration reference

This reference describes the options in [`src/project/config.ts`](../src/project/config.ts), including the fields inside lists and mappings. Use the [project customization guide](PROJECT-CUSTOMIZATION.md) for the setup workflow and settings that also require changes to translations, build configuration, public files, or deployment.

Options are grouped in the same order as `config.ts`:

- [Using the configuration](#using-the-configuration)
- [Application settings](#application-settings-app)
- [Articles](#articles)
- [Collections](#collections)
- [Ebooks](#ebooks)
- [Page settings](#page-settings-page)
- [Component settings](#component-settings-component)
- [Modal settings](#modal-settings-modal)

## Using the configuration

The exported `config` object is compiled into the browser and server builds. Rebuild after changing it. Regenerate routes after feature/auth changes, and regenerate enabled sitemaps and static menus when their content or settings change; see [route generation](PROJECT-CUSTOMIZATION.md#feature-based-route-generation) and [generated public content](PROJECT-CUSTOMIZATION.md#generated-public-content).

The current `Config` type permits arbitrary keys and values; it does not validate this structure. Use the types described below and retain the surrounding objects when editing an option. The values shipped in `config.ts` include example edition data and are not universal defaults.

In the tables, `boolean` means `true` or `false`, `string[]` means a list of strings, and `number[]` means a list of numbers. `[]` is an empty list; `{}` is an empty mapping. `<locale>`, `<collectionId>`, and other placeholders stand for actual keys in the configuration. The **Default / fallback** column describes what happens when an option is omitted. These are code-level fallbacks, which can differ from the explicit example values in `config.ts`. **Required** means there is no usable default for the relevant feature or list entry. Retain required edition identifiers and URLs even where a consumer constructs an empty string when they are missing. Explicit `false` and empty lists override defaults; exceptions for empty strings or `0` are described in the relevant rows.

Use public asset URLs such as `assets/images/banner.jpg` for files in `public/assets/images/`. The `public/` source directory is not part of the URL. Backend IDs, status codes, search fields, and image-size selectors must match the edition's backend data; a frontend option does not create that data. Keep credentials and secrets out of this file.

## Application settings (`app`)

| Option | Type / possible values | Default / fallback | Description |
| --- | --- | --- | --- |
| `app.siteURLOrigin` | `string`: absolute HTTP/HTTPS origin, such as `https://edition.example.org` | Request/browser origin for metadata; required for sitemap generation | Public origin used for absolute page links, SEO metadata, downloads/printing, and sitemap generation. Use the public website origin, without a locale prefix. |
| `app.projectNameDB` | `string`: backend project name | Required for backend requests | Identifies the edition in digital-edition API paths. |
| `app.projectId` | `number`: backend project ID | Required for entity/search queries | Identifies the edition in named-entity and Elasticsearch queries. |
| `app.backendBaseURL` | `string`: absolute API base URL | Required for backend requests | Base for digital-edition content requests; services append the project name and endpoint. Use no trailing slash. |
| `app.alternateFacsimileBaseURL` | `string`: absolute image base URL, or `''` | `''` | Serve facsimile images from separate storage using `<base>/<facsimileCollectionId>/<quality>/<imageNumber>.jpg`. Use no trailing slash. An empty string uses the backend's facsimile image endpoint. |
| `app.enableRouterLoadingBar` | `boolean` | `false` | Show the progress bar during router navigation. |

An alternate facsimile base URL changes where image files are loaded; facsimile metadata, collection IDs, and page counts still come from `app.backendBaseURL`. The image storage must follow the URL structure above. For example, a base of `https://images.example.org/facsimile_collection`, facsimile collection ID `12`, quality `1`, and image number `7` gives `https://images.example.org/facsimile_collection/12/1/7.jpg`. Quality comes from `component.facsimiles.imageQuality`, or `modal.fullscreenImageViewer.imageQuality` for fullscreen viewing.

### Internationalization (`app.i18n`)

Keep interface languages aligned with `angular.json`, translation files, development launchers, and nginx's default locale. See [internationalization setup](PROJECT-CUSTOMIZATION.md#internationalization).

| Option | Type / possible values | Default / fallback | Description |
| --- | --- | --- | --- |
| `app.i18n.languages` | Array of language objects | `[]`; configure at least one language | Available interface languages, in language-menu order. Each entry has the fields below. |
| `app.i18n.languages[].code` | `string`: emitted locale code, such as `sv`, `fi`, or `en` | Required in each language entry | Language identifier used in application links and localized content requests. Must match an enabled Angular locale and its URL subpath. |
| `app.i18n.languages[].label` | `string` | Required in each language entry | Language name displayed in the language menu, usually in that language. |
| `app.i18n.languages[].region` | Optional `string`: region code, such as `FI` | The entry's `code`, uppercased | Region used in Open Graph locale metadata, for example `sv_FI`. If omitted or empty, the language code is also used as the region. |
| `app.i18n.defaultLanguage` | `string`: one of the configured interface-language codes | First code in `app.i18n.languages`, or `"sv"` if none; see below | Default for unprefixed production requests and generated sitemap URLs; also used for the `hreflang` default. |
| `app.i18n.multilingualCollectionTableOfContents` | `boolean` | `false` | Request locale-specific collection information and tables of contents. Requires matching localized backend endpoints. |
| `app.i18n.multilingualReadingTextLanguages` | `string[]`: backend reading-text language codes, or `[]` | `[]` | Reading-text versions available for parallel viewing. More than one entry enables language-specific reading-text views and download choices. These are content languages, which may differ from interface languages. |
| `app.i18n.multilingualNamedEntityData` | `boolean` | `false` | Request named-entity details in the active interface language. Requires localized backend entity data. |

When `app.i18n.defaultLanguage` is omitted, the first configured interface language is used (`"sv"` if no language entries exist). Production SSR can only select an emitted locale: if the preferred language is absent from the build, it serves the first emitted locale instead. Configure `defaultLanguage` explicitly and keep it included in `angular.json` to make the intended language clear.

#### Multilingual reading texts

Set `app.i18n.multilingualReadingTextLanguages` to the backend language codes for parallel versions of the same publication, for example `["sv", "fi"]`. This is separate from selecting interface languages in `app.i18n.languages`. The backend must provide each text version through its localized reading-text endpoints. With an empty list or a single entry, the app uses the ordinary reading text without requesting a specific language.

When the list has two or more entries, enable `page.text.viewTypes.readingtext` and use the corresponding `readingtext_<language>` names in `page.text.defaultViews`. The plain `readingtext` view is replaced by these language-specific views:

```ts
app: {
  i18n: { multilingualReadingTextLanguages: ["sv", "fi"] }
},
page: {
  text: {
    defaultViews: ["readingtext_sv", "readingtext_fi", "facsimiles"],
    viewTypes: { readingtext: true, facsimiles: true }
  }
}
```

This example shows only the related settings; merge them into the existing `app` and `page` objects. Enabled reading-text download formats also get language-specific choices when the backend supplies matching download metadata. The current view labels and download headings cover Swedish (`sv`) and Finnish (`fi`); other reading-text languages need corresponding template and translation updates.

### Authentication (`app.auth`)

| Option | Type / possible values | Default / fallback | Description |
| --- | --- | --- | --- |
| `app.auth.enabled` | `boolean` | `false` | Enable authentication routes, guards, and authenticated requests. Protected routes return CSR shells rather than protected SSR content. See [authentication](AUTHENTICATION.md) before enabling it. |
| `app.auth.backendAuthBaseURL` | `string`: absolute authentication API base URL, or `''` | Origin of `app.backendBaseURL`, with a trailing slash | Base to which the auth service appends `auth` and related endpoint paths. A trailing slash is normalized. When empty, the service uses the origin of `app.backendBaseURL`. |

### Social sharing (`app.openGraphMetaTags`)

| Option | Type / possible values | Default / fallback | Description |
| --- | --- | --- | --- |
| `app.openGraphMetaTags.enabled` | `boolean` | `false` | Generate Open Graph metadata for social sharing. |
| `app.openGraphMetaTags.image` | Object keyed by interface-language code | No per-language overrides; use the home-banner settings | Per-language share-image settings. Each entry has `URL` and `altText`. |
| `app.openGraphMetaTags.image.<locale>.URL` | `string`: public image path, or `''` | `page.home.bannerImage.URL` | Image path resolved beneath the locale's public website root, such as `assets/images/share.jpg`. An empty value falls back to the home-page banner URL. Use an asset path rather than an arbitrary external URL. |
| `app.openGraphMetaTags.image.<locale>.altText` | `string`, or `''` | `page.home.bannerImage.altTexts.<locale>` | Localized image description. An empty value falls back to the home-page banner's alt text. |

### Generators (`app.prebuild`)

These flags control generator behavior. A local production build generates routes, while Docker also invokes the sitemap and static-menu generators; see [generated public content](PROJECT-CUSTOMIZATION.md#generated-public-content) for commands and output locations.

| Option | Type / possible values | Default / fallback | Description |
| --- | --- | --- | --- |
| `app.prebuild.sitemap` | `boolean` | `true` | Generate `public/sitemap.txt` when the sitemap script runs. Authentication mode excludes protected routes. |
| `app.prebuild.staticCollectionMenus` | `boolean` | `true` | Generate per-locale collection TOC HTML when the menu script runs, and enable use of that prebuilt content. Generation is skipped when auth or dynamic collection-menu SSR is enabled. |
| `app.prebuild.featureBasedRoutes` | `boolean` | `false` | Filter supported production routes using menus and content settings. `false` retains the canonical route set. See [feature-based route generation](PROJECT-CUSTOMIZATION.md#feature-based-route-generation); menu visibility alone is not access control. |

Turning off a generator does not remove files already present in `public/`; review existing output when changing these flags.

### Server rendering (`app.ssr`)

| Option | Type / possible values | Default / fallback | Description |
| --- | --- | --- | --- |
| `app.ssr.trustProxyHops` | `number`: non-negative integer | `2` | Maximum trusted proxy hops for resolving client IPs. Common values: `2` for HAProxy → nginx → Node, `1` for nginx → Node, and `0` for direct connections. The address list must also trust the proxies. |
| `app.ssr.trustedProxyAddresses` | `string[]`: IP addresses, CIDRs, or Express named ranges `loopback`, `linklocal`, `uniquelocal` | `["loopback", "linklocal", "uniquelocal"]` | Addresses trusted to forward client IPs and origin information. The shipped list trusts these three named ranges. `[]` disables proxy trust. |
| `app.ssr.collectionSideMenu` | `boolean` | `false` | Render the collection side menu dynamically during SSR. When `false`, prebuilt menu HTML can be used if enabled. Dynamic SSR skips static-menu generation. |

Both the hop limit and address list apply. The immediate peer must be trusted before its forwarded host/protocol headers are accepted. See [SSR and proxy settings](PROJECT-CUSTOMIZATION.md#ssr-and-proxy-settings) for deployment guidance and [Express's proxy reference](https://expressjs.com/en/guide/behind-proxies/) for address/range syntax.

## Articles

`articles` is an array of article objects and defaults to `[]` when omitted. Use `[]` when the edition has none. Each entry describes one localized article; versions in different languages share an `id` and can have different `routeName` values. The backend supplies the Markdown content.

| Field | Type / possible values | Default / fallback | Description |
| --- | --- | --- | --- |
| `articles[].id` | `string`: backend article node ID without the language prefix, such as `"04-01"` | Required in each article entry | Stable ID connecting localized versions of the same article. The app prefixes it with the active interface language: `"04-01"` becomes `"sv-04-01"` for Swedish content. |
| `articles[].language` | `string`: interface-language code | Required in each article entry | Language of this article entry. |
| `articles[].routeName` | `string`: URL segment | Required in each article entry | Public route under `/article/<routeName>`. Use a URL-safe name without surrounding slashes. |
| `articles[].title` | Optional `string` | Backend menu title; no content-grid title | Override the article's menu/content-grid title. |
| `articles[].coverURL` | Optional `string`: public image URL/path | No cover image | Cover image for the article's content-grid card. |
| `articles[].enableTOC` | Optional `boolean` | `true` | Enable the heading-based article TOC; enabled when omitted. |
| `articles[].downloadOptions` | Optional array of download objects | No download links | Download links. The article toolbar currently uses the first entry when `page.article.showTextDownloadButton` is enabled. |
| `articles[].downloadOptions[].url` | `string`: public file URL/path | Required in each download entry | Download target, such as `assets/files/article.pdf`. |
| `articles[].downloadOptions[].label` | Optional `string` | Translated download label; this field is not used by the toolbar | Label stored with the download link; the article toolbar currently uses its translated download label. |

Example:

```ts
articles: [
  {
    id: "04-01",
    language: "sv",
    routeName: "om-utgavan",
    title: "Om utgåvan",
    coverURL: "assets/images/about.jpg",
    enableTOC: true,
    downloadOptions: [{ url: "assets/files/about.pdf", label: "PDF" }]
  },
  { id: "04-01", language: "fi", routeName: "tietoa-julkaisusta" }
]
```

## Collections

| Option | Type / possible values | Default / fallback | Description |
| --- | --- | --- | --- |
| `collections.addTEIClassNames` | `boolean` | `false` | Add shared TEI CSS classes to processed reading texts, manuscripts, and variants so the shared TEI styles apply. |
| `collections.replaceImageAssetsPaths` | `boolean` | `false` | Rewrite `src="images/..."` references in processed content to `src="assets/images/..."`. |
| `collections.enableLegacyIDs` | `boolean` | `false` | Resolve legacy collection/publication IDs through the backend for legacy links and references. |
| `collections.enableMathJax` | `boolean` | `false` | Enable browser MathJax typesetting for text content. Requires a compatible MathJax script exposing `MathJax.Hub` in `src/index.html`. |
| `collections.firstTextItem` | Object mapping collection IDs to `string` text-item IDs | No configured text destinations | Fallback destination when a collection has no enabled front-matter page. IDs use `<collectionId>_<publicationId>` with an optional chapter suffix, such as `216_20280` or `218_20230_ch2`. |
| `collections.firstTextItem.<collectionId>` | `string`: text-item ID | No destination; configure when the collection has no front-matter page | Initial reading-text destination for that collection. |
| `collections.highlightSearchMatches` | `boolean` | `true` | Carry search-match information into collection text pages opened from search results so matches can be highlighted. |
| `collections.inlineIllustrations` | `number[]`: collection IDs | `[]` | Collections whose reading-text illustrations remain visible inline. Other collections' illustration elements are hidden inline. |
| `collections.mediaCollectionMappings` | Object mapping collection IDs to `number` gallery IDs | `{}` | Connect reading-text illustrations to backend media collections. |
| `collections.mediaCollectionMappings.<collectionId>` | `number`: backend gallery/media-collection ID | No gallery mapping | Gallery used when constructing that collection's illustration URLs. |
| `collections.order` | `number[][]`: ordered groups of collection IDs, or `[]` | `[]` | Select and order collections. Inner arrays define groups in the main menu; flattened order is used by the content grid and generators. |

Use numbers in `order`, `inlineIllustrations`, and the exclusion lists below. Object keys in `firstTextItem` and `mediaCollectionMappings` represent collection IDs. An empty `order` selects no collections for the main menu, content grid, or generators. Menu group titles come from the `MainSideMenu.CollectionsGroup1` through `MainSideMenu.CollectionsGroup5` translations.

Example:

```ts
order: [[216, 219], [220]],
firstTextItem: { 216: "216_20280", 219: "219_19443" },
mediaCollectionMappings: { 216: 44 }
```

### Front-matter pages

`collections.frontMatterPages` enables each page type globally. `collections.frontMatterPageDisabled` excludes individual collections from an otherwise enabled type. These flags affect navigation and supported route generation; they do not provide authorization.

| Option | Type / possible values | Default / fallback | Description |
| --- | --- | --- | --- |
| `collections.frontMatterPages.cover` | `boolean` | `false` | Enable collection cover pages. |
| `collections.frontMatterPages.title` | `boolean` | `false` | Enable collection title pages. |
| `collections.frontMatterPages.foreword` | `boolean` | `false` | Enable collection foreword pages. |
| `collections.frontMatterPages.introduction` | `boolean` | `false` | Enable collection introduction pages. |
| `collections.frontMatterPageDisabled.cover` | `number[]`: collection IDs | `[]` | Omit the cover page for these collections. |
| `collections.frontMatterPageDisabled.title` | `number[]`: collection IDs | `[]` | Omit the title page for these collections. |
| `collections.frontMatterPageDisabled.foreword` | `number[]`: collection IDs | `[]` | Omit the foreword page for these collections. |
| `collections.frontMatterPageDisabled.introduction` | `number[]`: collection IDs | `[]` | Omit the introduction page for these collections. |

## Ebooks

`ebooks` is an array of ebook objects and defaults to `[]` when omitted. Use `[]` when the edition has none. The current ebook page displays PDFs; other formats such as EPUB can be provided as download links.

| Field | Type / possible values | Default / fallback | Description |
| --- | --- | --- | --- |
| `ebooks[].title` | `string` | Required in each ebook entry | Title in navigation and the ebook page. |
| `ebooks[].filename` | `string`: filename with extension | Required in each ebook entry | Ebook identifier used to construct `/ebook/<extension>/<name>` routes. For a local PDF, place this file in `public/assets/ebooks/`. |
| `ebooks[].collectionId` | Optional `number`: backend collection ID | No search-hit mapping | Connect PDF search hits from that collection to this ebook route. |
| `ebooks[].externalFileURL` | Optional `string`: absolute file URL, or `''` | Local `assets/ebooks/<filename>` URL | Load the PDF from this URL instead of `assets/ebooks/<filename>`. The external host must allow browser access. |
| `ebooks[].coverURL` | Optional `string`: public image URL/path, or `''` | No cover image | Cover image for the ebook's content-grid card. |
| `ebooks[].downloadOptions` | Optional array of download objects | No download links | Links presented in the PDF download menu. |
| `ebooks[].downloadOptions[].url` | `string`: public file URL/path | Required in each download entry | Download target; can offer PDF, EPUB, or another available format. |
| `ebooks[].downloadOptions[].label` | Optional `string` | No label | Display label, such as `PDF` or `EPUB`. |

Example:

```ts
ebooks: [
  {
    title: "Edition PDF",
    filename: "edition.pdf",
    coverURL: "assets/images/ebook-cover.jpg",
    downloadOptions: [
      { url: "assets/ebooks/edition.pdf", label: "PDF" },
      { url: "assets/ebooks/edition.epub", label: "EPUB" }
    ]
  }
]
```

## Page settings (`page`)

### About and articles

| Option | Type / possible values | Default / fallback | Description |
| --- | --- | --- | --- |
| `page.about.initialPageNode` | `string`: backend about-page node suffix, such as `01-01` | `"01"` | About page opened by the top-menu button. The app prefixes this value with `03-`, so `01-01` becomes `03-01-01`. |
| `page.article.showTextDownloadButton` | `boolean` | `false` | Show the article download button using the article's first `downloadOptions` entry. Supply a valid download URL. |
| `page.article.showURNButton` | `boolean` | `false` | Show the reference/URN button on article pages. |

### Ebook

| Option | Type / possible values | Default / fallback | Description |
| --- | --- | --- | --- |
| `page.ebook.showURNButton` | `boolean` | `false` | Show the reference/URN button on ebook pages. |

### Search (`page.elasticSearch`)

These settings configure the Elasticsearch-backed search page. Search indices, fields, type codes, and query objects must match the backend's index mappings.

An edition without full-text search can omit `page.elasticSearch`. Explicitly set `component.mainSideMenu.items.search`, `component.topMenu.showElasticSearchButton`, and `page.home.showSearchbar` to `false`; the top-menu search button defaults to `true`. Enable `app.prebuild.featureBasedRoutes` and regenerate routes to exclude the search route from production builds.

Elasticsearch is also used by some named-entity features independently of full-text search. For an edition without Elasticsearch, set `page.index.persons.database` to `"default"` for the person index, and keep `component.mainSideMenu.items.indexKeywords`, `component.mainSideMenu.items.indexPlaces`, and `component.mainSideMenu.items.indexWorks` disabled. If work details are needed, set `modal.namedEntity.useSimpleWorkMetadata` to `true` to use the direct backend.

| Option | Type / possible values | Default / fallback | Description |
| --- | --- | --- | --- |
| `page.elasticSearch.enableFilters` | `boolean` | `true` | Show the faceted-search filter controls. Fixed query filters still apply when controls are hidden. |
| `page.elasticSearch.enableSortOptions` | `boolean` | `true` | Show search-result sorting controls. |
| `page.elasticSearch.filterGroupsOpenByDefault` | `string[]`: keys from `aggregations` | `[]` | Filter groups initially expanded, such as `Years`, `Type`, `Genre`, and `Collection`. |
| `page.elasticSearch.hitsPerPage` | `number`: positive integer | `20` | Search-result page size. |
| `page.elasticSearch.indices` | `string[]`: Elasticsearch index names | `[]`; configure indices when using search | Indices requested through the edition's search API. |
| `page.elasticSearch.openReadingTextWithComments` | `boolean` | `false` | Include the comments view when opening a reading-text hit from search results. |
| `page.elasticSearch.textHighlightFragmentSize` | `number`: non-negative integer | `150` | Requested highlighted body-text fragment length in characters. For the `unified` sentence scanner, `0` keeps sentences unsplit. |
| `page.elasticSearch.textHighlightType` | `string`: `fvh`, `unified`, or `plain` for ordinary text fields | `"fvh"` | Elasticsearch highlighter for body text. Must be compatible with the backend's field mapping. |
| `page.elasticSearch.textTitleHighlightType` | `string`: `fvh`, `unified`, or `plain` for ordinary text fields | `"fvh"` | Elasticsearch highlighter for titles; titles are requested without fragment splitting. |
| `page.elasticSearch.typeFilterGroupOptions` | `string[]`: backend text-type codes, or `[]` | `[]` | Text types included in all searches and aggregation queries. Common codes: `est` (reading text), `com` (comments), `var` (variants), `inl` (introduction), `tit` (title), `fore` (foreword), `ms` (manuscript), and `pdf`. Empty means no fixed text-type restriction. |
| `page.elasticSearch.fixedFilters` | Array of Elasticsearch query objects, or `[]` | `[]` | Query clauses added to every search and aggregation query, for example restricting deleted/published records. |
| `page.elasticSearch.fixedFilters[].terms` | Object mapping indexed field names to value arrays | Required when using a `terms` clause | The shipped filters use Elasticsearch `terms` clauses. Other supported query clauses can be used when the backend accepts them. |
| `page.elasticSearch.fixedFilters[].terms.deleted` | Array of indexed values, such as `["0"]` | No deletion-status restriction | Restrict the backend's deletion-status field. Match the index's actual value type. |
| `page.elasticSearch.fixedFilters[].terms.published` | Array of indexed values, such as `["2"]` | No publication-status restriction | Restrict the backend's publication-status field. Match the index's actual value type. |
| `page.elasticSearch.additionalSourceFields` | `string[]`: indexed field paths | `[]` | Extra `_source` fields returned with hits, in addition to those required by the application. |
| `page.elasticSearch.aggregations` | Object mapping filter-group names to Elasticsearch aggregation definitions | No aggregation definitions / filter groups | Define the search facets. Definitions used by the UI return `terms` or `date_histogram` buckets. |

The `fvh` highlighter requires term vectors with positions and offsets in the index. See [Elasticsearch highlighting](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/highlighting) for supported highlighters and field requirements, and [highlighting settings](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/highlighting-settings) for fragment behavior.

#### Aggregation definitions

The search page recognizes the group names below. Each name is a case-sensitive key in `page.elasticSearch.aggregations` and can also appear in `page.elasticSearch.filterGroupsOpenByDefault`. Include only the groups relevant to the edition's indexed data; their order in `aggregations` determines their display order. Names outside this list require template changes to provide a filter-group heading.

| Group | Type | Indexed field / purpose |
| --- | --- | --- |
| `Years` | `date_histogram` | `orig_date_sort`: original publication dates grouped by year; used by the year-range control. |
| `Type` | `terms` | `text_type`: content types. |
| `Genre` | `terms` | `publication_data.genre.keyword`: publication genres. |
| `Collection` | `terms` | `publication_data.collection_name.keyword`: display collection names stored in the index. |
| `CollectionId` | `terms` | `collection_id`: collection IDs, displayed as collection titles fetched from the backend. An alternative to `Collection` when the index stores IDs rather than names. |
| `Language` | `terms` | `text_language`: content-language codes, displayed as language names in the active interface language. These describe the indexed texts and need not match `app.i18n.languages`. |
| `LetterSenderName` | `terms` | `sender_subject_name.keyword`: letter senders. |
| `LetterReceiverName` | `terms` | `receiver_subject_name.keyword`: letter recipients. |
| `LetterSenderLocation` | `terms` | `sender_location_name.keyword`: sending locations. |
| `LetterReceiverLocation` | `terms` | `receiver_location_name.keyword`: receiving locations. |
| `Region` | `terms` | The edition's indexed region field: geographic regions. |
| `Signum` | `terms` | The edition's indexed archival-reference field: archival reference codes. |

For example, an edition can use collection IDs and content languages as its only categorical filters:

```ts
aggregations: {
  Years: {
    date_histogram: { field: "orig_date_sort", calendar_interval: "year", format: "yyyy" }
  },
  CollectionId: { terms: { field: "collection_id", size: 20 } },
  Language: { terms: { field: "text_language", size: 20 } }
},
filterGroupsOpenByDefault: ["Years", "CollectionId"]
```

Use field paths that exist in the edition's index, and size each categorical group to include the required choices. For each group, `<group>` below stands for its key. Keep `Years` as a year histogram of `orig_date_sort` with year-formatted labels when using the existing year-range UI; date-range queries use that field.

| Field | Type / possible values | Default / fallback | Description |
| --- | --- | --- | --- |
| `page.elasticSearch.aggregations.<group>.terms` | Object | Required for a categorical group | Term-bucket definition for a categorical filter. |
| `page.elasticSearch.aggregations.<group>.terms.field` | `string`: indexed field path | Required for the group | Field whose distinct values form the filter choices; usually a keyword field. |
| `page.elasticSearch.aggregations.<group>.terms.size` | `number`: positive integer | `10` (Elasticsearch default) | Maximum number of term buckets returned. |
| `page.elasticSearch.aggregations.<group>.terms.order` | Optional object mapping sort keys to `"asc"` or `"desc"` | Elasticsearch sorts by descending document count; the UI sorts choices alphabetically | Elasticsearch bucket ordering. The shipped groups that specify an order use `_key`. |
| `page.elasticSearch.aggregations.<group>.terms.order._key` | `string`: `"asc"` or `"desc"` | Not set; the UI sorts choices alphabetically | Order buckets by their value. Without this setting, the UI sorts categorical choices alphabetically. |
| `page.elasticSearch.aggregations.<group>.date_histogram` | Object | Required for a date group | Date-bucket definition; used for `Years`. |
| `page.elasticSearch.aggregations.<group>.date_histogram.field` | `string`: indexed date field | Required for the group | Date used to build histogram buckets. |
| `page.elasticSearch.aggregations.<group>.date_histogram.calendar_interval` | `string`: Elasticsearch calendar interval, such as `"year"` | Required: `"year"` for the year-range control | Calendar unit for the buckets. The app's year-range UI expects `"year"`. |
| `page.elasticSearch.aggregations.<group>.date_histogram.format` | `string`: Elasticsearch date format, such as `"yyyy"` | Required: `"yyyy"` for the year-range control | Bucket-label format. Use `"yyyy"` for the existing year-range UI. |

These definitions are sent to Elasticsearch through the backend. The application passes these definitions through without filling in missing fields. Elasticsearch supplies the `terms.size` and `terms.order` defaults shown above; see the [terms-aggregation reference](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-terms-aggregation). See the [date-histogram reference](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-datehistogram-aggregation) for interval/format syntax. Additional DSL options depend on the backend's Elasticsearch version and the UI's expected bucket shape.

### Foreword

| Option | Type / possible values | Default / fallback | Description |
| --- | --- | --- | --- |
| `page.foreword.showURNButton` | `boolean` | `true` | Show the foreword reference/URN button. |
| `page.foreword.showViewOptionsButton` | `boolean` | `true` | Show the foreword display-options button. |

### Home (`page.home`)

| Option | Type / possible values | Default / fallback | Description |
| --- | --- | --- | --- |
| `page.home.bannerImage.altTexts` | Object mapping locale codes to strings | `{}` | Localized descriptions of the banner image. |
| `page.home.bannerImage.altTexts.<locale>` | `string` | `"image"` | Banner alt text for that interface language; also a fallback for share-image alt text. |
| `page.home.bannerImage.intrinsicSize.height` | `number` (positive pixel height) or `null` | `null` (attribute omitted) | Intrinsic image height for the `<img>` element. `null` omits the attribute. |
| `page.home.bannerImage.intrinsicSize.width` | `number` (positive pixel width) or `null` | `null` (attribute omitted) | Intrinsic image width for the `<img>` element. `null` omits the attribute. |
| `page.home.bannerImage.orientationPortrait` | `boolean` | `false` | Select the portrait-image home layout. `false` uses the landscape layout. This is independent of viewport orientation conditions in `alternateSources[].media`. |
| `page.home.bannerImage.alternateSources` | Array of source objects, or `[]` | `[]` | Responsive image sources, in `<picture>` order. Empty uses the banner URL directly. Source fields are described below. |
| `page.home.bannerImage.URL` | `string`: public image URL/path | `"assets/images/home-page-banner.jpg"` | Banner image, fallback image for `<picture>`, and default share image. |
| `page.home.portraitOrientationSettings.imagePlacement.onRight` | `boolean` | `false` | Place the portrait image to the right in the layout. |
| `page.home.portraitOrientationSettings.imagePlacement.squareCroppedVerticalOffset` | `string`: CSS vertical `object-position` value, such as `"10%"`, `"center"`, or `''` | Stylesheet's object position | Vertical position of the portrait image when cropped; combined with a horizontal position of `50%`. Empty uses the stylesheet's position. |
| `page.home.portraitOrientationSettings.siteTitleOnImageOnSmallScreens` | `boolean` | `false` | Overlay the site title/subtitle on the portrait image on small screens. |
| `page.home.showContentGrid` | `boolean` | `false` | Show content cards on the home page; configure their content under `component.contentGrid`. |
| `page.home.showFooter` | `boolean` | `false` | Show the backend Markdown footer. |
| `page.home.showSearchbar` | `boolean` | `false` | Show the home-page search bar linking to the search page. Keep the search route enabled if using it. |

Each `alternateSources` entry can contain these HTML `<source>` attributes:

| Field | Type / possible values | Default / fallback | Description |
| --- | --- | --- | --- |
| `page.home.bannerImage.alternateSources[].srcset` | `string`: HTML source-set value | Required in each source entry | Image URL(s) with optional width/density descriptors. |
| `page.home.bannerImage.alternateSources[].media` | Optional `string`: CSS media query | Attribute omitted | Condition under which this source applies, such as viewport width, height, orientation, or pixel density. |
| `page.home.bannerImage.alternateSources[].sizes` | Optional `string`: HTML sizes value | Attribute omitted | Display-size hints for a width-based source set. |
| `page.home.bannerImage.alternateSources[].type` | Optional `string`: image MIME type | Attribute omitted | Format hint, such as `image/avif`, `image/jpeg`, or `image/webp`. |
| `page.home.bannerImage.alternateSources[].height` | Optional positive `number` | Attribute omitted | Intrinsic height of this source. |
| `page.home.bannerImage.alternateSources[].width` | Optional positive `number` | Attribute omitted | Intrinsic width of this source. |

The browser considers sources in list order, choosing the first with a matching media condition and supported format. Put a preferred format before its fallback for the same condition, and general sources without `media` last. `page.home.bannerImage.URL` supplies the fallback `<img>` URL.

Example:

```ts
alternateSources: [
  { media: "(max-width: 600px)", srcset: "assets/images/banner-small.avif", type: "image/avif" },
  { media: "(max-width: 600px)", srcset: "assets/images/banner-small.jpg", type: "image/jpeg" },
  { srcset: "assets/images/banner-large.avif", type: "image/avif" },
  { srcset: "assets/images/banner-large.jpg", type: "image/jpeg" }
]
```

### Named-entity indices (`page.index`)

| Option | Type / possible values | Default / fallback | Description |
| --- | --- | --- | --- |
| `page.index.keywords.maxFetchSize` | `number`: positive integer, capped at `10000` | `500` | Keyword records requested per fetch. |
| `page.index.keywords.showFilter` | `boolean` | `false` | Show keyword-index filter controls. |
| `page.index.keywords.publishedStatus` | `number`: backend publication-status code | `2` | Status matched by keyword-index queries; also used as the minimum publication status in keyword occurrences. The shipped value is `2`. |
| `page.index.persons.database` | `string`: `"elastic"` or another string | `"elastic"` | `"elastic"` uses Elasticsearch for the person index. Other values, like `"default"`, select the direct backend person-list endpoint. |
| `page.index.persons.maxFetchSize` | `number`: positive integer, capped at `10000` | `500` | Person records requested per Elasticsearch fetch; the direct person-list endpoint loads its whole result. |
| `page.index.persons.showFilter` | `boolean` | `false` | Show person-index filter controls when the Elasticsearch source is used. |
| `page.index.persons.publishedStatus` | `number`: backend publication-status code | `2` | Status matched by Elasticsearch person-index queries; also used as the minimum publication status in person occurrences. |
| `page.index.places.maxFetchSize` | `number`: positive integer, capped at `10000` | `500` | Place records requested per fetch. |
| `page.index.places.showFilter` | `boolean` | `false` | Show place-index filter controls. |
| `page.index.places.publishedStatus` | `number`: backend publication-status code | `2` | Status matched by place-index queries; also used as the minimum publication status in place occurrences. |
| `page.index.works.publishedStatus` | `number`: backend publication-status code | `2` | Minimum publication status in work occurrences. The current work-index listing query does not use this setting. |

Status-code meanings come from the edition backend. Index visibility is selected by `component.mainSideMenu.items.indexKeywords`, `indexPersons`, `indexPlaces`, and `indexWorks`.

### Introduction

| Option | Type / possible values | Default / fallback | Description |
| --- | --- | --- | --- |
| `page.introduction.hasSeparateTOC` | `boolean` | `false` | Display the introduction's embedded TOC as a separate menu. Requires backend content containing a `<div data-id="content">` TOC block. |
| `page.introduction.showTextDownloadButton` | `boolean` | `false` | Show the introduction download button; available formats come from `modal.downloadTexts.introductionFormats`. |
| `page.introduction.showURNButton` | `boolean` | `true` | Show the introduction reference/URN button. |
| `page.introduction.showViewOptionsButton` | `boolean` | `true` | Show the introduction display-options button. |
| `page.introduction.viewOptions.personInfo` | `boolean` | `false` | Offer the person-annotation toggle in introduction display options. |
| `page.introduction.viewOptions.placeInfo` | `boolean` | `false` | Offer the place-annotation toggle. |
| `page.introduction.viewOptions.workInfo` | `boolean` | `false` | Offer the work-annotation toggle. |
| `page.introduction.viewOptions.paragraphNumbering` | `boolean` | `true` | Offer paragraph/line numbering. |
| `page.introduction.viewOptions.pageBreakEdition` | `boolean` | `false` | Offer printed-edition page numbers. |

These `viewOptions` flags control which toggles are offered, rather than their initial checked state. The introduction forces reading-text-only toggles such as comments, emendations, and original page numbers off.

### Media collection

| Option | Type / possible values | Default / fallback | Description |
| --- | --- | --- | --- |
| `page.mediaCollection.showURNButton` | `boolean` | `false` | Show the media-collection reference/URN button. |

### Collection texts (`page.text`)

| Option | Type / possible values | Default / fallback | Description |
| --- | --- | --- | --- |
| `page.text.defaultViews` | `string[]`: enabled view names | `["readingtext"]` | Views opened initially, in column order, when no URL/recent view selection applies. Use `readingtext`, `comments`, `facsimiles`, `manuscripts`, `variants`, `illustrations`, `legend`, or `metadata`. For multilingual reading texts, use `readingtext_<language>`, such as `readingtext_sv`; see [multilingual reading texts](#multilingual-reading-texts) for the related settings. |
| `page.text.defaultViewOptions` | `string[]`: keys from `page.text.viewOptions`, or `[]` | `[]` | Annotation/display flags initially switched on in the shared view-options state, such as `["comments", "personInfo"]`. This also affects pages using that shared state. |
| `page.text.showTextDownloadButton` | `boolean` | `false` | Show the collection-text download button. Formats are configured under `modal.downloadTexts`. |
| `page.text.showURNButton` | `boolean` | `true` | Show the collection-text reference/URN button. |
| `page.text.showViewOptionsButton` | `boolean` | `true` | Show the collection-text display-options button. |

Default views must be enabled for the collection. Disabled defaults are omitted; if none remain, the page falls back to the first enabled view. `showAll` is an add-all action, not an initial view. When multilingual defaults begin with a language-specific reading text, the active interface language's reading text is moved first when available.

#### Display-option controls (`page.text.viewOptions`)

Each boolean makes a toggle available in the display-options popover. Set initial checked flags in `page.text.defaultViewOptions` instead. The text's TEI markup and selected stylesheet bundles determine which annotations can be shown; see [TEI styles](THEMING.md#tei-styles).

| Option | Type / possible values | Default / fallback | Description |
| --- | --- | --- | --- |
| `page.text.viewOptions.comments` | `boolean` | `false` | Offer commentary-marker highlighting. |
| `page.text.viewOptions.personInfo` | `boolean` | `false` | Offer person-annotation highlighting. |
| `page.text.viewOptions.placeInfo` | `boolean` | `false` | Offer place-annotation highlighting. |
| `page.text.viewOptions.emendations` | `boolean` | `false` | Offer editorial-change highlighting. |
| `page.text.viewOptions.normalisations` | `boolean` | `false` | Offer normalization highlighting. |
| `page.text.viewOptions.workInfo` | `boolean` | `false` | Offer work-annotation highlighting. |
| `page.text.viewOptions.abbreviations` | `boolean` | `false` | Offer abbreviation highlighting. |
| `page.text.viewOptions.paragraphNumbering` | `boolean` | `false` | Offer paragraph/line numbers. |
| `page.text.viewOptions.pageBreakOriginal` | `boolean` | `false` | Offer original-source page numbers. |
| `page.text.viewOptions.pageBreakEdition` | `boolean` | `false` | Offer printed-edition page numbers. |

#### Variant options (`page.text.variantViewOptions`)

| Option | Type / possible values | Default / fallback | Description |
| --- | --- | --- | --- |
| `page.text.variantViewOptions.showVariationTypeOption` | `boolean` | `false` | Offer the variant-difference display selector. |
| `page.text.variantViewOptions.defaultVariationType` | `string`: `"all"`, `"sub"`, or `"none"` | `"all"` | Initially show all differences, substantial differences only, or no differences. Other values fall back to `"all"`. |

#### Available views and collection exclusions

`page.text.viewTypes` controls the add-view choices. `page.text.viewTypeDisabledCollections` excludes specific numeric collection IDs from each view. An enabled choice also needs corresponding backend content.

| Option | Type / possible values | Default / fallback | Description |
| --- | --- | --- | --- |
| `page.text.viewTypes.showAll` | `boolean` | `false` | Offer the desktop action that opens all enabled views. |
| `page.text.viewTypes.readingtext` | `boolean` | `false` | Offer reading-text views, with language-specific choices when configured. |
| `page.text.viewTypes.comments` | `boolean` | `false` | Offer the commentary view. |
| `page.text.viewTypes.facsimiles` | `boolean` | `false` | Offer facsimile images. |
| `page.text.viewTypes.manuscripts` | `boolean` | `false` | Offer manuscript/transcription views. |
| `page.text.viewTypes.variants` | `boolean` | `false` | Offer variant texts. |
| `page.text.viewTypes.illustrations` | `boolean` | `false` | Offer reading-text illustrations as a separate view. |
| `page.text.viewTypes.legend` | `boolean` | `false` | Offer the textual-symbols legend. |
| `page.text.viewTypes.metadata` | `boolean` | `false` | Offer publication metadata. |
| `page.text.viewTypeDisabledCollections.readingtext` | `number[]`: collection IDs | `[]` | Disable reading-text choices for these collections. |
| `page.text.viewTypeDisabledCollections.comments` | `number[]`: collection IDs | `[]` | Disable the comments view for these collections. |
| `page.text.viewTypeDisabledCollections.facsimiles` | `number[]`: collection IDs | `[]` | Disable facsimiles for these collections. |
| `page.text.viewTypeDisabledCollections.manuscripts` | `number[]`: collection IDs | `[]` | Disable manuscripts for these collections. |
| `page.text.viewTypeDisabledCollections.variants` | `number[]`: collection IDs | `[]` | Disable variants for these collections. |
| `page.text.viewTypeDisabledCollections.illustrations` | `number[]`: collection IDs | `[]` | Disable the illustrations view for these collections. |
| `page.text.viewTypeDisabledCollections.legend` | `number[]`: collection IDs | `[]` | Disable the legend for these collections. |
| `page.text.viewTypeDisabledCollections.metadata` | `number[]`: collection IDs | `[]` | Disable metadata for these collections. |

### Title page

| Option | Type / possible values | Default / fallback | Description |
| --- | --- | --- | --- |
| `page.title.loadContentFromMarkdown` | `boolean` | `false` | Load title-page content from backend Markdown instead of the title-text endpoint. |
| `page.title.showURNButton` | `boolean` | `true` | Show the title-page reference/URN button. |
| `page.title.showViewOptionsButton` | `boolean` | `true` | Show the title-page display-options button. |

## Component settings (`component`)

### Collection side menu

Unlike numeric collection-selection/exclusion lists, the sorting lists below use **string** IDs, because they are compared with collection IDs from the route.

| Option | Type / possible values | Default / fallback | Description |
| --- | --- | --- | --- |
| `component.collectionSideMenu.sortableCollectionsAlphabetical` | `string[]`: collection IDs, such as `["211"]` | `[]` | Offer alphabetical TOC ordering by item text for these collections. |
| `component.collectionSideMenu.sortableCollectionsChronological` | `string[]`: collection IDs | `[]` | Offer chronological TOC grouping by the backend item's `date` field. |
| `component.collectionSideMenu.sortableCollectionsCategorical` | `string[]`: collection IDs | `[]` | Offer category-based TOC grouping using the sort keys below. |
| `component.collectionSideMenu.categoricalSortingPrimaryKey` | `string`: backend TOC-item field name | `"date"` | First-level category/grouping key, such as `date`. Set a valid field when enabling categorical sorting. |
| `component.collectionSideMenu.categoricalSortingSecondaryKey` | `string`: backend TOC-item field name, or `''` | `''` | Optional second-level category key. Empty omits secondary grouping. |

### Content grid

The grid is displayed when `page.home.showContentGrid` is enabled. Collection cards use `collections.order`; these options add other content or change presentation.

| Option | Type / possible values | Default / fallback | Description |
| --- | --- | --- | --- |
| `component.contentGrid.includeArticles` | `boolean` | `false` | Include articles for the active locale. Their entries can provide titles and cover images. |
| `component.contentGrid.includeEbooks` | `boolean` | `false` | Include configured ebooks. |
| `component.contentGrid.includeMediaCollection` | `boolean` | `false` | Include the media-collection entry. |
| `component.contentGrid.mediaCollectionCoverURL` | `string`: public image URL/path, or `''` | `''` | Cover image for that media-collection entry. |
| `component.contentGrid.mediaCollectionCoverAltTexts` | Object mapping locale codes to strings | `{}` | Localized media-collection cover descriptions. |
| `component.contentGrid.mediaCollectionCoverAltTexts.<locale>` | `string` | Translated `MainSideMenu.MediaCollections` label | Alt text for that language. |
| `component.contentGrid.showTitles` | `boolean` | `true` | Show card titles. |

### Facsimiles

| Option | Type / possible values | Default / fallback | Description |
| --- | --- | --- | --- |
| `component.facsimiles.imageQuality` | `number`: backend image-size selector, such as `4` | `1` | Size/quality variant requested for inline facsimiles. Use a value supported by the image backend; the frontend does not define a fixed range. `0` omits the size segment for the default backend endpoint. |
| `component.facsimiles.showTitle` | `boolean` | `true` | Show facsimile titles. |

### Main side menu

Each `component.mainSideMenu.items` flag enables a navigation group or link. Hiding a menu item alone leaves routes available when feature-based filtering is off. With filtering enabled, some flags also control supported production routes; see [route filtering](PROJECT-CUSTOMIZATION.md#feature-based-route-generation).

Index entries form one menu block at the first enabled index flag's position in `items`, including when ungrouped. Their order within that block follows the flags' order.

| Option | Type / possible values | Default / fallback | Description |
| --- | --- | --- | --- |
| `component.mainSideMenu.items.about` | `boolean` | `false` | Show the backend about-page tree. |
| `component.mainSideMenu.items.articles` | `boolean` | `false` | Show the configured article navigation. |
| `component.mainSideMenu.items.ebooks` | `boolean` | `false` | Show configured ebooks. |
| `component.mainSideMenu.items.collections` | `boolean` | `false` | Show collection navigation. |
| `component.mainSideMenu.items.mediaCollections` | `boolean` | `false` | Show the media-collection link. |
| `component.mainSideMenu.items.indexKeywords` | `boolean` | `false` | Show the keyword index. |
| `component.mainSideMenu.items.indexPersons` | `boolean` | `false` | Show the person index. |
| `component.mainSideMenu.items.indexPlaces` | `boolean` | `false` | Show the place index. |
| `component.mainSideMenu.items.indexWorks` | `boolean` | `false` | Show the work index. |
| `component.mainSideMenu.items.search` | `boolean` | `false` | Show the search link. |
| `component.mainSideMenu.items.cookiePolicy` | `boolean` | `false` | Show the cookie-policy link. |
| `component.mainSideMenu.items.termsOfUse` | `boolean` | `false` | Show terms of use; also show its link in login/registration. |
| `component.mainSideMenu.items.privacyPolicy` | `boolean` | `false` | Show the privacy-policy link; also show it in login/registration. |
| `component.mainSideMenu.items.accessibilityStatement` | `boolean` | `false` | Show the accessibility-statement link. |
| `component.mainSideMenu.defaultExpanded` | `boolean` | `false` | Initially expand menu groups rather than keeping them collapsed. |
| `component.mainSideMenu.ungroupArticles` | `boolean` | `false` | Put article entries directly in the menu rather than beneath a group labeled by `MainSideMenu.Articles`. When `false` or omitted, retain the article wrapper. |
| `component.mainSideMenu.ungroupIndices` | `boolean` | `false` | Put enabled index links directly in the menu rather than beneath a collapsible localized group. When `false` or omitted, group all enabled indices, including a single index, preserving index order from `items`. No group appears when all indices are disabled. |

### Manuscripts

| Option | Type / possible values | Default / fallback | Description |
| --- | --- | --- | --- |
| `component.manuscripts.showTitle` | `boolean` | `true` | Show manuscript titles, including titles in printable manuscript output. |
| `component.manuscripts.showNormalizedToggle` | `boolean` | `true` | Offer switching between the transcription with changes and its normalized text. Requires both backend versions. |
| `component.manuscripts.showOpenLegendButton` | `boolean` | `false` | Show the button for opening the textual-symbols legend. |

### Top menu and variants

| Option | Type / possible values | Default / fallback | Description |
| --- | --- | --- | --- |
| `component.topMenu.showAboutButton` | `boolean` | `true` | Show the About button using `page.about.initialPageNode`. |
| `component.topMenu.showContentButton` | `boolean` | `true` | Show the Content button. |
| `component.topMenu.showElasticSearchButton` | `boolean` | `true` | Show the search button. This also keeps search included when feature-based route filtering is enabled. |
| `component.topMenu.showLanguageButton` | `boolean` | `true` | Show the interface-language selector. |
| `component.variants.showOpenLegendButton` | `boolean` | `false` | Show the legend-opening button in variant views. |

## Modal settings (`modal`)

### Text downloads (`modal.downloadTexts`)

Each format group is an object whose supported format keys have boolean values:

| Option | Type | Default / fallback | Description |
| --- | --- | --- | --- |
| `modal.downloadTexts.introductionFormats` | Format-options object | `{}` | Formats offered for introduction downloads. |
| `modal.downloadTexts.readingTextFormats` | Format-options object | `{}` | Formats offered for reading-text downloads. |
| `modal.downloadTexts.commentsFormats` | Format-options object | `{}` | Formats offered for commentary downloads. |
| `modal.downloadTexts.manuscriptsFormats` | Format-options object | `{}` | Formats offered for manuscript downloads. |

For **each** group above, `<group>` below stands for its exact name, for example `readingTextFormats`. The same five options apply to all four groups:

| Option | Type / possible values | Default / fallback | Description |
| --- | --- | --- | --- |
| `modal.downloadTexts.<group>.xml` | `boolean` | `false` | Offer XML download. |
| `modal.downloadTexts.<group>.html` | `boolean` | `false` | Offer HTML download. |
| `modal.downloadTexts.<group>.xhtml` | `boolean` | `false` | Offer XHTML download. |
| `modal.downloadTexts.<group>.txt` | `boolean` | `false` | Offer plain-text download. |
| `modal.downloadTexts.<group>.print` | `boolean` | `false` | Offer printable output through the browser's print flow. |

File formats require backend support for the selected text type. The page download-button flags control access to this modal; format flags control its choices. An empty group offers no formats.

### Fullscreen images and references

| Option | Type / possible values | Default / fallback | Description |
| --- | --- | --- | --- |
| `modal.fullscreenImageViewer.imageQuality` | `number`: backend image-size selector | `component.facsimiles.imageQuality` (or its fallback `1`) | Size/quality variant for fullscreen facsimiles. Must be supported by the image backend. `0` or an omitted value uses `component.facsimiles.imageQuality`. |
| `modal.referenceData.URNResolverURL` | `string`: absolute resolver base URL, such as `https://urn.fi/` | `"https://urn.fi/"` | Prefix added to backend URNs to create reference links. Include the separator required before the URN. |

### Named entities (`modal.namedEntity`)

These settings apply to details dialogs for persons, places, keywords, and works. A flag enables a field or data request; it does not add missing metadata to the backend.

| Option | Type / possible values | Default / fallback | Description |
| --- | --- | --- | --- |
| `modal.namedEntity.showAliasAndPrevLastName` | `boolean` | `true` | Show aliases and previous last names when supplied. |
| `modal.namedEntity.showArticleData` | `boolean` | `false` | Fetch and show articles associated with the entity. |
| `modal.namedEntity.showCityRegionCountry` | `boolean` | `false` | Show city, region, and country fields. |
| `modal.namedEntity.showDescriptionLabel` | `boolean` | `false` | Present the description as a labeled metadata field. `false` presents it as an unlabeled paragraph. |
| `modal.namedEntity.showGalleryOccurrences` | `boolean` | `false` | Fetch and show the entity's gallery occurrences. |
| `modal.namedEntity.showMediaData` | `boolean` | `false` | Fetch and show associated media data, such as an entity image. |
| `modal.namedEntity.showOccupation` | `boolean` | `false` | Show occupation beside the entity heading. |
| `modal.namedEntity.showOccurrences` | `boolean` | `true` | Show the text-occurrences accordion. Publication visibility follows the relevant `page.index.<type>.publishedStatus`. |
| `modal.namedEntity.showType` | `boolean` | `false` | Show the entity's type field. |
| `modal.namedEntity.useSimpleWorkMetadata` | `boolean` | `false` | Use simple backend work details instead of Elasticsearch manifestation metadata; also controls work-tooltip and occurrence metadata presentation. |
