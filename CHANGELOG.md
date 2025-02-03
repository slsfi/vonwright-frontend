# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).



## [Unreleased]

### Changed

- Replace `copyfiles` package with a custom script to copy `proxy-server.js` to `dist/app` after the Angular build.
- Deps: update `@angular/core` to 19.1.4 and `@angular/cli` to 19.1.5.
- Deps: update `marked` to 15.0.6.
- Deps (dev): update `ng-extract-i18n-merge` to 2.14.1.



## [1.5.5] – 2024-12-30

### Changed

- Illustration modal component: remove unused import component. ([3e47941](https://github.com/slsfi/digital-edition-frontend-ng/commit/3e479415a7b1dea9e0c4b3ad4eec2caa136a8078))
- Migrate deprecated Sass `@import` rules and built-in global functions. Some `@import` rules in `global.scss` have not yet been migrated to avoid breaking changes in projects. These rules will be migrated in the next major version. ([2fb5830](https://github.com/slsfi/digital-edition-frontend-ng/commit/2fb583046a69d14fbb9f3c86d601cf88c6f0fb8e))
- Deps: update `@angular/core` to 19.0.5 and `@angular/cli` to 19.0.6. ([2507ab7](https://github.com/slsfi/digital-edition-frontend-ng/commit/2507ab754f951c3e44701c437eca8734c5a01e26))
- Deps: update `express` to 4.21.2 and `path-to-regexp` to 0.1.12. ([3bb136a](https://github.com/slsfi/digital-edition-frontend-ng/commit/3bb136aa88be9c64f78cba84b25b065441f4d7b9))
- Deps: update `marked` to 15.0.4. ([8c79846](https://github.com/slsfi/digital-edition-frontend-ng/commit/8c79846933df2e5793ff810298c4e18666905a27))
- Deps (dev): update `@types/jasmine` to 5.1.5. ([546201a](https://github.com/slsfi/digital-edition-frontend-ng/commit/546201a6168ec678893127abc663b3620cbe8e51))
- Deps (dev): update `@types/node` to 20.17.10. ([8b9f4bf](https://github.com/slsfi/digital-edition-frontend-ng/commit/8b9f4bf7963c8172ebe40fbe92d6be9523cc0610))
- Deps (dev): update `jasmine-core` to 5.5.0. ([79e21a6](https://github.com/slsfi/digital-edition-frontend-ng/commit/79e21a6b201861a99e7d4cb0329caf3fede00204))
- Deps (dev): update `ng-extract-i18n-merge` to 2.13.1. ([14c38a7](https://github.com/slsfi/digital-edition-frontend-ng/commit/14c38a7f8c7cd41e724ffbf0b4d9a089db43f7b6))
- Deps (dev): update `typescript` to 5.6.3. ([633c344](https://github.com/slsfi/digital-edition-frontend-ng/commit/633c344f921d7a53c6fe456e533984a9542dea75))
- Deps (transitive): update `nanoid` to 3.3.8. ([cd6287e](https://github.com/slsfi/digital-edition-frontend-ng/commit/cd6287e52b13958e9dde1daa3d462f7e872df378))
- Deps (transitive): update multiple by recreating `package-lock.json`. ([bac3a84](https://github.com/slsfi/digital-edition-frontend-ng/commit/bac3a84b5827b4dbe0983d5b545cfd14880a71bd))



## [1.5.4] – 2024-11-11

### Changed

- Deps: update `@angular` to 18.2.11. ([7d3b184](https://github.com/slsfi/digital-edition-frontend-ng/commit/7d3b1844ad671edd5bc61d6d9fd2cd1bb483909f))
- Deps: update `express` to 4.21.1. ([c02930e](https://github.com/slsfi/digital-edition-frontend-ng/commit/c02930eb4e00e101851aca817c3a10331f1b0b07))
- Deps: update `marked` to 15.0.0. ([2979390](https://github.com/slsfi/digital-edition-frontend-ng/commit/297939095e3471800b3901ee0b79e461cb3bac30))
- Deps: update `tslib` to 2.8.1. ([92f7631](https://github.com/slsfi/digital-edition-frontend-ng/commit/92f76318e7efee24b816deaf8528a97501dfea59))
- Deps: pin `@ionic` to 8.2.2. ([5275d39](https://github.com/slsfi/digital-edition-frontend-ng/commit/5275d397aa62dc4a8a6919846125aa0f2cacdcff))
- Deps (dev): update `@types/node` to 20.17.6. ([2685ec8](https://github.com/slsfi/digital-edition-frontend-ng/commit/2685ec862679bf1915c201f58adef6f6ca6e33c9))
- Deps (dev): update `jasmine-core` to 5.4.0. ([82b4437](https://github.com/slsfi/digital-edition-frontend-ng/commit/82b4437892cd96a89d5ce6ce46dcf7a96c37396f))
- Deps (transitive): update multiple by recreating `package-lock.json`. ([d3557a6](https://github.com/slsfi/digital-edition-frontend-ng/commit/d3557a688de7c8960a232d2c01246767f9e39b30), [bfa02a1](https://github.com/slsfi/digital-edition-frontend-ng/commit/bfa02a1c6af527fd17fbc721c3fdd93bcbee7151))



## [1.5.3] – 2024-09-26

### Changed

- Deps: update `@angular` to 18.2.6. ([112623d](https://github.com/slsfi/digital-edition-frontend-ng/commit/112623d7935a45c049871c01a14d69cbda839e51))
- Deps: update `express` to 4.21.0. ([ccbe649](https://github.com/slsfi/digital-edition-frontend-ng/commit/ccbe649304e9d2db74a448e1d13a54cc1be90196))
- Deps: update `marked` to 14.1.2. ([70e6fb7](https://github.com/slsfi/digital-edition-frontend-ng/commit/70e6fb75c5d87d4a4664c16ac4789bb09b18afd1))
- Deps (dev): update `@types/node` to 20.16.9. ([1ec69f7](https://github.com/slsfi/digital-edition-frontend-ng/commit/1ec69f7261474461b673d54fc6ea3f7b7c2f3ae4))
- Deps (dev): update `jasmine-core` to 5.3.0. ([7d72e39](https://github.com/slsfi/digital-edition-frontend-ng/commit/7d72e39287ed5a3af06f87eecf8e76069c49826d))
- Deps (transitive): update `browser-sync` to 3.0.3 and `serve-static` to 1.16.2. ([04a421d](https://github.com/slsfi/digital-edition-frontend-ng/commit/04a421dad2ac9239921712bed85ac988b68f9bf1))



## [1.5.2] – 2024-08-30

### Fixed

- Named entity modal: prevent text wrapping in labels. ([dd0664a](https://github.com/slsfi/digital-edition-frontend-ng/commit/dd0664a6f61ba0328e587c1e7a0ebf29e01df957))

### Changed

- Dependabot configuration: allow security updates of `@angular` packages. ([066d45e](https://github.com/slsfi/digital-edition-frontend-ng/commit/066d45e931ec96db562d7a26de31451c4e4fe7f0))
- Deps: update `@angular` to 18.2.2. ([2ff2b72](https://github.com/slsfi/digital-edition-frontend-ng/commit/2ff2b72ab4a3d50750d1396f71bb8713d1652d0e))
- Deps (transitive): update `micromatch` to 4.0.8. ([a74b1d7](https://github.com/slsfi/digital-edition-frontend-ng/commit/a74b1d793c8d0e571d3b74669416ddec4c6d06d4))



## [1.5.1] – 2024-08-28

### Fixed

- Generate static collection menus prebuild script: skip collections that are not included according to the config. ([6a5a339](https://github.com/slsfi/digital-edition-frontend-ng/commit/6a5a339c01beae2ea5155a099c9910f978636b0e))
- Generate sitemap prebuild script: skip collections that are not included according to the config. ([b5b84a2](https://github.com/slsfi/digital-edition-frontend-ng/commit/b5b84a2b07f3cd801fbc8112fa0d80b7eb557dc8))
- Home page: start-aligned instead of left-aligned text. ([f714e09](https://github.com/slsfi/digital-edition-frontend-ng/commit/f714e09589fa9336e3296aa34772889e13bdada6))



## [1.5.0] – 2024-08-28

### Added

- PDF viewer on ebooks page: PDF title to secondary toolbar. ([4351a3f](https://github.com/slsfi/digital-edition-frontend-ng/commit/4351a3f177abb0f6626845722b2d61ba4899fa60))
- PDF viewer on ebooks page: message and download link to PDF as fallback if the user’s browser doesn’t support viewing embedded PDFs. ([7aa557c](https://github.com/slsfi/digital-edition-frontend-ng/commit/7aa557ccf9fc4f2f889ce6f1c5b06b1ba5482800))
- PDF viewer on ebooks page: support navigating to specific page in PDF. Fixes incorrect translations for the component. ([8250ca9](https://github.com/slsfi/digital-edition-frontend-ng/commit/8250ca9db471110ed0c3098fc0bebf0dc77530d4))
- PDF viewer on ebooks page: support search term highlighting in PDF (dependent on browser support, which currently includes only Firefox). ([118e7b0](https://github.com/slsfi/digital-edition-frontend-ng/commit/118e7b059f7c19c0d90bfd7eff218a2019d0a6fe))
- Assets: the SLS logo in various sizes as PNG images. ([33fe8b4](https://github.com/slsfi/digital-edition-frontend-ng/commit/33fe8b42541517483bedf4a4f455891bbdc6185a))
- Elasticsearch page: filter labels for regions and reference numbers. ([6e52f09](https://github.com/slsfi/digital-edition-frontend-ng/commit/6e52f09268abee44cf2b8f6e9b6ff406a5d2baae))
- Elasticsearch page: support PDF type search results for PDFs ingested in Elasticsearch as one page in plain text format per document. For links from the search results to correctly map to PDFs on the ebook pages, you need to enter the PDFs as collections in the database, and add a `collectionId` property to each ebook object in the ebooks array in the config. ([c3d8695](https://github.com/slsfi/digital-edition-frontend-ng/commit/c3d86952a4b59bd07f6196d686ae852faf3384b6))

### Changed

- `backendBaseURL` in config set to `https://api.sls.fi/digitaledition` by default. ([7cea657](https://github.com/slsfi/digital-edition-frontend-ng/commit/7cea657bdb2f14f7b6664bb336a40f5078042a38))
- Home page: reduce landscape banner image height to 40% on viewport widths less than 1100px. ([e6cbab6](https://github.com/slsfi/digital-edition-frontend-ng/commit/e6cbab65e66dd7daaaf3077360c1f3e71d30102e))
- Content grid: fetch collection cover image data only for collections included in the config. ([f2028fa](https://github.com/slsfi/digital-edition-frontend-ng/commit/f2028fa772314e8fd3d55ba2296fe92cfc0fcdef))
- Elasticsearch page: rename Elastic hit path and queryparams pipes. ([c9d9606](https://github.com/slsfi/digital-edition-frontend-ng/commit/c9d9606bdf53219311bbcdf192e5d5e18b1233c9))
- Rename trust HTML pipe file. ([bb2ab6c](https://github.com/slsfi/digital-edition-frontend-ng/commit/bb2ab6cbef633685012dd62f11db8dc53fd382e7))
- Update `nginx` to 1.26.2. ([58d5bf2](https://github.com/slsfi/digital-edition-frontend-ng/commit/58d5bf2b909620547182630814b8366aaf720d90))
- Deps: update `@angular` to 18.2.1. ([d1508ea](https://github.com/slsfi/digital-edition-frontend-ng/commit/d1508ea155b681fb8c3910b79d5d817d297b17ca))
- Deps: update `marked` to 14.1.0. ([210b9a7](https://github.com/slsfi/digital-edition-frontend-ng/commit/210b9a7615f794be2da73fdd0e1f4b083f657f28))
- Deps: update `tslib` to 2.7.0. ([cc67715](https://github.com/slsfi/digital-edition-frontend-ng/commit/cc6771522669bb00759be59f5df7d40426458f8f))
- Deps (dev): update `@types/node` to 20.16.2. ([ce75cd8](https://github.com/slsfi/digital-edition-frontend-ng/commit/ce75cd8d3fde1f8a9d478fe984ff866a18b3fa59))

### Fixed

- Media collections: reduce filter select widths to prevent clear button from wrapping to a new line when all three filter categories are available. ([a33b48a](https://github.com/slsfi/digital-edition-frontend-ng/commit/a33b48a0565114c75cfd7c65fd3723d48d59617b))
- Document title set correctly when going back to previous collection pages in nav stack. ([36d4839](https://github.com/slsfi/digital-edition-frontend-ng/commit/36d4839eaac13c805f15a1036d72af43202629fd))
- Home page: sticky footer. ([bab6d0d](https://github.com/slsfi/digital-edition-frontend-ng/commit/bab6d0d07c73bb2bad07f14d017e2b9cdc7b1a93))

### Removed

- `index.html`: deprecated and outdated meta tags. ([2bf9c2e](https://github.com/slsfi/digital-edition-frontend-ng/commit/2bf9c2ee1061eda3c8be9d285d9c216a7a26ba49))
- `compose.yml`: testa-vonwright.sls.fi from extra hosts. ([5bb6ff8](https://github.com/slsfi/digital-edition-frontend-ng/commit/5bb6ff836fc58fe1aa5545226e1816b44ebe88e8))



## [1.4.4] – 2024-08-08

### Added

- Configuration file for Dependabot version updates of packages. ([741796c](https://github.com/slsfi/digital-edition-frontend-ng/commit/741796c70b4a7b04df8330fbe6e40114bbdc8453), [7f08e0b](https://github.com/slsfi/digital-edition-frontend-ng/commit/7f08e0b1036231d854dc5e687b66e25285d4cef1))

### Changed

- Docs: mention current Node version of app in README. ([a7f854d](https://github.com/slsfi/digital-edition-frontend-ng/commit/a7f854d0fb09fdea946023ad567b7303cd46ab86))
- Deps: update `@angular` to 18.1.4. ([f6e829a](https://github.com/slsfi/digital-edition-frontend-ng/commit/f6e829a5116048f7c72de1307eafe6583ce209b4))
- Deps: update `marked` to 14.0.0. ([d73fa2c](https://github.com/slsfi/digital-edition-frontend-ng/commit/d73fa2c6f2e3cf716c6c62c5834e860bf63c9a9f), [aa72d73](https://github.com/slsfi/digital-edition-frontend-ng/commit/aa72d73dffb22f1926b771d071e64a0a7f0e9151))
- Deps: update `zone.js` to 0.14.10. ([26ce24e](https://github.com/slsfi/digital-edition-frontend-ng/commit/26ce24e0b83cf3273fc0fee17195623cae71c699))
- Deps (dev): update `@types/node` to 20.14.14. ([bb6b347](https://github.com/slsfi/digital-edition-frontend-ng/commit/bb6b3476e05c4a8760c36d1eebdfc20fefa0f380))
- Deps (dev): update `karma` to 6.4.4. ([7d7008f](https://github.com/slsfi/digital-edition-frontend-ng/commit/7d7008fbec1fa7cbc976af787760e918674aa87b))
- Deps (dev): update `typescript` to 5.5.4. ([53679f7](https://github.com/slsfi/digital-edition-frontend-ng/commit/53679f7ea87cc09a58129d0ec4c70c46d5ea1e24))

### Fixed

- Match type when comparing collection IDs in text-changer component (i.e. allow `collectionId` to be either string or number in table of content JSON-files). ([8f3142d](https://github.com/slsfi/digital-edition-frontend-ng/commit/8f3142d9252e2014c3550223f62bf9676cfc8d5c))
- Add missing `ngFor` import to `pdf-viewer.component`. ([b751172](https://github.com/slsfi/digital-edition-frontend-ng/commit/b75117289732e5f4b00b4ac4d885b3f420498183))
- Filter type headings should not be visible in index filter modal when no filter options available. ([ff975df](https://github.com/slsfi/digital-edition-frontend-ng/commit/ff975dfacc50f3f71c2295b7553fdbcfa9f05b3e))
- Home page banner image `min-height` set to `200px` in landscape image mode. This fixes an issue where the banner image height is too small on mobile phones in landscape orientation. You should adjust the `min-height` for the banner image in your project in `custom.scss` if necessary. You can use the selector `page-home div.banner.banner`. ([d5b717d](https://github.com/slsfi/digital-edition-frontend-ng/commit/d5b717d22d0a2e57325f8090b10006248627965b))



## [1.4.3] – 2024-07-22

### Changed

- Legacy key-value format for `NODE_ENV` in `Dockerfile`. ([385b67e](https://github.com/slsfi/digital-edition-frontend-ng/commit/385b67e3d0303b84dabe41185c5299ca19da4191))
- Docs: refactor code snippets in the development notes and add note about NgModules. ([c3552a9](https://github.com/slsfi/digital-edition-frontend-ng/commit/c3552a9aa05dea9a2c56bc8da9cdc94b00f6589e))
- Deps: update `@angular` to 18.1.1. ([9af16d9](https://github.com/slsfi/digital-edition-frontend-ng/commit/9af16d9e62e3785117e4179e8187a0de52a92182))
- Deps: update `marked` to 13.0.2. ([6471779](https://github.com/slsfi/digital-edition-frontend-ng/commit/647177992e61b752eed1a1d460c7ce0dba5bf9fe))
- Deps: update `zone.js` to 0.14.8 (includes SSR memory leakage fix). ([9eced7c](https://github.com/slsfi/digital-edition-frontend-ng/commit/9eced7caa4fb9bdbff0cc230e37678a72e7006f4))
- Deps (dev): update `@types/node` to 20.14.11. ([0afdcc2](https://github.com/slsfi/digital-edition-frontend-ng/commit/0afdcc22e0346b2877021aecae14774aca1aac0b))
- Deps (dev): update `jasmine-core` to 5.2.0. ([b107f9e](https://github.com/slsfi/digital-edition-frontend-ng/commit/b107f9e7c26205f42eb1171a9ef60686b0dc4200))
- Deps (dev): update `typescript` to 5.5.3. ([5897905](https://github.com/slsfi/digital-edition-frontend-ng/commit/589790558aa92b58b7bc3550416e0eafb0a70076))

### Fixed

- Incorrect CSS selector for references after comments. ([898a2b7](https://github.com/slsfi/digital-edition-frontend-ng/commit/898a2b7bcbe27c13a31800ff8cbb789c29ecb6d7))



## [1.4.2] – 2024-07-02

### Changed

- Deps: update `@angular` to 18.0.5. ([f8129f1](https://github.com/slsfi/digital-edition-frontend-ng/commit/f8129f187c5ce3679fce24a69939bd25980bf341))
- Deps: update `marked` to 13.0.1. ([f871a15](https://github.com/slsfi/digital-edition-frontend-ng/commit/f871a15523384f4709587c0e5fd436ca4d3fbd21))
- Deps (dev): update `@types/node` to 20.14.9. ([154f481](https://github.com/slsfi/digital-edition-frontend-ng/commit/154f4814570ba6252345b2c4d2de3d0bf429f4f8))
- Deps (dev): update `ws`, `engine.io-client`, `engine.io` and `socket.io-adapter`. ([09a926e](https://github.com/slsfi/digital-edition-frontend-ng/commit/09a926ed6796e6f60f2763f258794d454f44b88e))



## [1.4.1] – 2024-06-17

### Changed

- Deps: update `@angular` to 18.0.3. ([a18049e](https://github.com/slsfi/digital-edition-frontend-ng/commit/a18049ec7cd2e8adca45770319305d116af3d193))

### Fixed

- Active media collection filters do not clear properly when deselecting all filter options for a filter group. ([a708a0d](https://github.com/slsfi/digital-edition-frontend-ng/commit/a708a0d937058af9278105a3709a6e984061ff84))

### Removed

- Superfluous addition of `Title` service to providers in `AppModule`. ([06c141a](https://github.com/slsfi/digital-edition-frontend-ng/commit/06c141af3b24097f0e729a8be5f547f289dd0519))



## [1.4.0] – 2024-06-14

### Added

- Support for showing a ”facsimile-only icon” next to items in the collection side menu that have the `facsimileOnly` property set to `true` in the collection table of contents file. ([fc7e0c6](https://github.com/slsfi/digital-edition-frontend-ng/commit/fc7e0c6818a2545dfa2914f9418a5ba274fc69f5))

### Changed

- Change search method on the (named entity) index page from fuzzy to substring search when the provider is ElasticSearch. ([ce30c3e](https://github.com/slsfi/digital-edition-frontend-ng/commit/ce30c3e42dac5b46edd5b0c9f82f6f894f5f91e8))
- Unwrap lone grouped collections in the main side menu: if a collection group contains just one collection, the group menu item will not be collapsible/expandable, instead the menu item will link directly into the collection. The menu item title will still be the title of the collection group (defined in translation xliff-files). ([ff7ac04](https://github.com/slsfi/digital-edition-frontend-ng/commit/ff7ac04bb3e5bd26648dfce9c2d1361b4ae83701))
- Deps: update `@angular` to 17.3.11. ([dd7cbc5](https://github.com/slsfi/digital-edition-frontend-ng/commit/dd7cbc5cb295bce053c782d8503bf5d75f44ce44))
- Deps: update `@ionic` to 8.2.2. ([746218a](https://github.com/slsfi/digital-edition-frontend-ng/commit/746218a82d0fd39e2ece3e21a1e5c2a77070c925))
- Deps: update `marked` to 13.0.0. ([85699b3](https://github.com/slsfi/digital-edition-frontend-ng/commit/85699b37ac585955a28caf465ecbd41388fbd31d))
- Deps: update `tslib` to 2.6.3. ([0065912](https://github.com/slsfi/digital-edition-frontend-ng/commit/0065912532533b05286971f385f8f817c384e7a0))
- Deps: update `zone.js` to 0.14.7. ([1061fd3](https://github.com/slsfi/digital-edition-frontend-ng/commit/1061fd3f713c1b3b7bc8fff0c31ce595227e1560))
- Deps (dev): update `@types/node` to 20.14.2. ([a2b72de](https://github.com/slsfi/digital-edition-frontend-ng/commit/a2b72deab51b3e54a616a0bbbfa9fa2ecc6be09c))
- Deps (dev): update `braces` to 3.0.3. ([6a559f3](https://github.com/slsfi/digital-edition-frontend-ng/commit/6a559f3a3a5fc5e9d8708399850a14645a66c3f7))
- Deps (dev): update `ng-extract-i18n-merge` to 2.12.0. ([62aa573](https://github.com/slsfi/digital-edition-frontend-ng/commit/62aa5731705c5355fdd8870f90038e9a18ff35f2))
- Update transitive dependencies by recreating `package-lock.json`. ([2f6f6d6](https://github.com/slsfi/digital-edition-frontend-ng/commit/2f6f6d6dda8b93b00599b7631cae734eb4b63ee1))
- Update `nginx` to 1.26.1. ([3fe3dd9](https://github.com/slsfi/digital-edition-frontend-ng/commit/3fe3dd9df4e230fe5fc5fd901b4e37812b64f038))



## [1.3.4] – 2024-05-07

### Changed

- Run app as non-root user to increase security. ([578937c](https://github.com/slsfi/digital-edition-frontend-ng/commit/578937ce7040914221d8bfd8893ea5cb620e32e7))
- Deps: update `@angular` to 17.3.7. ([547c4e8](https://github.com/slsfi/digital-edition-frontend-ng/commit/547c4e8a55c2cc1952f6fd780645a39125e683af))
- Deps: update `@ionic` to 8.1.0. ([8bde0a4](https://github.com/slsfi/digital-edition-frontend-ng/commit/8bde0a4d79648a22cb021d7ed8d51a8a41ed6641))
- Deps: update `ionicons` to 7.4.0. ([1a4bb08](https://github.com/slsfi/digital-edition-frontend-ng/commit/1a4bb08a4ef936c6450a97db513dc629dbb7b80d))
- Deps: update `marked` to 12.0.2. ([db5dc72](https://github.com/slsfi/digital-edition-frontend-ng/commit/db5dc72e25563d1962e2bf6e52794b3af1ab9f1c))
- Deps: update `zone.js` to 0.14.5. ([412caa0](https://github.com/slsfi/digital-edition-frontend-ng/commit/412caa0a77abbbbb63b33363a43c8cacdeba9912))
- Deps: update `@types/node` to 20.12.10. ([524024e](https://github.com/slsfi/digital-edition-frontend-ng/commit/524024e1c3848e76a81da157d5f4a512aae93f3b), [0508562](https://github.com/slsfi/digital-edition-frontend-ng/commit/0508562d47188e0d77115323d9c1bb7c926298b3))
- Deps: update `typescript` to 5.4.5. ([4a8c95f](https://github.com/slsfi/digital-edition-frontend-ng/commit/4a8c95fd55f8ca549e1a13096052daf9d57d6caf))
- Update `nginx` to 1.26.0. ([4e3bdfa](https://github.com/slsfi/digital-edition-frontend-ng/commit/4e3bdfabaee74d63bcde720d60f823e9d8f1000f))



## [1.3.3] – 2024-04-04

### Added

- Docs: notes on how to run nginx in front of Node.js app locally. ([caf8d1e](https://github.com/slsfi/digital-edition-frontend-ng/commit/caf8d1eab58b3976d1f3941422ea7d707adc3b3d))

### Changed

- Replace deprecated `browserTarget` with `buildTarget` in `extract-i18n` options in `angular.json`. ([96c94fe](https://github.com/slsfi/digital-edition-frontend-ng/commit/96c94fe8aa278db0943d8e67fe907db83429f810))
- Ensure build uses latest version of Node.js Docker-image. Remove unnecessary quotes around strings in GitHub Actions YAML build file. ([971e06e](https://github.com/slsfi/digital-edition-frontend-ng/commit/971e06e7f63a49cc86b75f81eb4afe5a8d07650a))
- Docs: restructure notes on running app locally. ([a41dc7d](https://github.com/slsfi/digital-edition-frontend-ng/commit/a41dc7dbc79bb86915b6b5d14122fdd7b43d59bf))
- Update `nginx` to 1.25.4. ([2ce5529](https://github.com/slsfi/digital-edition-frontend-ng/commit/2ce55297e8b100fed7d86735f0529a49d4265377))
- Deps: update `@angular` to 17.3.3. ([e531f86](https://github.com/slsfi/digital-edition-frontend-ng/commit/e531f86ad64103c4e6e5c7502b48613a6bb9c994), [0873abb](https://github.com/slsfi/digital-edition-frontend-ng/commit/0873abbf59e55ae81b66e2cc0a0b31cfcd97a234))
- Deps: update `@ionic` to 7.8.3. ([29bd2ae](https://github.com/slsfi/digital-edition-frontend-ng/commit/29bd2aee08a50bd8b1e583a04fbf8556fe50f49d), [aa69990](https://github.com/slsfi/digital-edition-frontend-ng/commit/aa69990b39dcafa527314a3ba07fff330897a184))
- Deps: update `express` to 4.19.2. ([a4443eb](https://github.com/slsfi/digital-edition-frontend-ng/commit/a4443eb821bb2889ba82f31b0884ffd9b2d29e46))
- Deps: update `ionicons` to 7.3.1. ([9d0bc07](https://github.com/slsfi/digital-edition-frontend-ng/commit/9d0bc0723c6bdea0be60fe424a37cb1071855450))
- Deps: update `marked` to 12.0.1. ([2978215](https://github.com/slsfi/digital-edition-frontend-ng/commit/2978215d540529034f4edd6dcede40674041fdce))
- Deps: update `@types/node` to 20.12.4. ([5987f3a](https://github.com/slsfi/digital-edition-frontend-ng/commit/5987f3a78ce7bdf2634fb136c511d771d7d3bcd8), [11f0385](https://github.com/slsfi/digital-edition-frontend-ng/commit/11f0385db2f690c10d6cb90413dd62311b48dd07))
- Deps: update `ng-extract-i18n-merge` to 2.11.2. ([bd55fd0](https://github.com/slsfi/digital-edition-frontend-ng/commit/bd55fd08449ddc5b852ebf7a3e47c943ed40be29), [68d72fe](https://github.com/slsfi/digital-edition-frontend-ng/commit/68d72fe60cdfd0966aab19d28996047e140d3916))
- Deps: update `typescript` to 5.4.3. ([fd5d49f](https://github.com/slsfi/digital-edition-frontend-ng/commit/fd5d49f9a8b3e32494aa949ebb475688946a422e))
- Deps: update `es5-ext` to 0.10.64 ([e06c6d4](https://github.com/slsfi/digital-edition-frontend-ng/commit/e06c6d4dc3f835ef7d87add1a95288aca7cc97b6))
- Deps: update `follow-redirects` to 1.15.6. ([82d4839](https://github.com/slsfi/digital-edition-frontend-ng/commit/82d4839f395b4d09aeaaa06ce2b787ffcb0472ff))

### Fixed

- Link-elements added to the DOM using a custom renderer in the document head service are cleaned up when the service is destroyed. This fixes a potential memory leak in the SSR-app. ([736195e](https://github.com/slsfi/digital-edition-frontend-ng/commit/736195e4e6097c24a6452ad5294ad29ea6e90293))
- Return values of the RxJS `catchError` function. ([fb862c2](https://github.com/slsfi/digital-edition-frontend-ng/commit/fb862c2e801a9f232d3fc92d704e9bebc5bd632b))
- Ensure cleanup of event listeners in the draggable-image directive. ([0b2f871](https://github.com/slsfi/digital-edition-frontend-ng/commit/0b2f871a737ec2daec91a08e3021289782f9dd41))



## [1.3.2] – 2024-02-29

### Changed

- Button labels in the secondary toolbar are hidden when the viewport is less than or equal to 960px wide, the same as for the labels in the top menu. ([79973f5](https://github.com/slsfi/digital-edition-frontend-ng/commit/79973f5f28a7c99a75b78cb208488e47ef89c092))
- Set `fetchpriority` property to `high` on image element of home page banner image. ([942ec0d](https://github.com/slsfi/digital-edition-frontend-ng/commit/942ec0dbb20f2cc4bc81a473a35cea2e4aaa627e))
- Deps: update `@angular` to 17.2.3. ([c9c28e9](https://github.com/slsfi/digital-edition-frontend-ng/commit/c9c28e96a061e8ae215daf189b9c0db5d3ea40b9), [7d76625](https://github.com/slsfi/digital-edition-frontend-ng/commit/7d76625d925f31c37223d37c5fb79852e2f4bb40))
- Deps: update `@ionic` to 7.7.3. ([434306c](https://github.com/slsfi/digital-edition-frontend-ng/commit/434306c51a24ed1ea4fa5ab76a1ab2b58d989541))
- Deps: update `express` to 4.18.3. ([19cd3a5](https://github.com/slsfi/digital-edition-frontend-ng/commit/19cd3a598e4b6a781675df9dc59b45f1c26ecbe3))
- Deps: update `@types/node` to 20.11.23. ([1460e29](https://github.com/slsfi/digital-edition-frontend-ng/commit/1460e29ade3a53d6cb4c5c88be65f22223e73154), [5a0198a](https://github.com/slsfi/digital-edition-frontend-ng/commit/5a0198a89bec8c680610cf992104e2f195dc55fd))
- Deps: update `karma` to 6.4.3. ([4e66d5d](https://github.com/slsfi/digital-edition-frontend-ng/commit/4e66d5ddb3cbd6d693d4657ca11f7b6694707662))

### Fixed

- Missing collection menu when navigating backward using browser history if collection changes. ([11687bb](https://github.com/slsfi/digital-edition-frontend-ng/commit/11687bbf6d4859685550b75de7df3857fab963c1))



## [1.3.1] – 2024-02-19

### Fixes

- Memory leak related to BehaviorSubject-subscription in the download-texts modal. Also, as a precation, unsubscribe from all route subscriptions on component destruction. ([b32dfe4](https://github.com/slsfi/digital-edition-frontend-ng/commit/b32dfe4e74393ecb64aad4f83d415fa60f2f37bb))



## [1.3.0] – 2024-02-16

### Added

- Config options to enable server-side rendering of the collection side menu and prebuild static versions of the menu: `config.app.ssr.collectionSideMenu` and `config.app.prebuild.staticCollectionMenus`. Both options are booleans. `config.app.ssr.collectionSideMenu` defaults to `false`, which means that rendering of the dynamic collection side menu is not performed on the server, but deferred to the browser. This increases performance on the server for projects that have very large collections (hundreds of texts/collection). `config.app.prebuild.staticCollectionMenus` defaults to `true`, which means that static HTML versions of each collection menu, in each project language, are generated when the Docker image of the app is built. The static collection menus are included in the server-side rendering of collection pages, and then replaced with the dynamic collection menus in the browser. This improves SEO of collection pages when server-side rendering of collection menus is disabled, without degrading the user experience. Setting both new options to `false` puts the least load on the server, but makes the web app less crawlable by robots. **Notice** that the static menus are generated during *build-time* – if the collection table of contents are updated in the backend, a new build has to be created for the changes to be reflected in the static menus. ([a25be18](https://github.com/slsfi/digital-edition-frontend-ng/commit/a25be1899f2e35e3cb8dec398907738bc573427b), [78108e3](https://github.com/slsfi/digital-edition-frontend-ng/commit/78108e32352caed9d111d11d7fefb9f5c8f8ef32), [2ec89c3](https://github.com/slsfi/digital-edition-frontend-ng/commit/2ec89c39b0fdd86447ce53a49b041fcdd41be2c4), [5848028](https://github.com/slsfi/digital-edition-frontend-ng/commit/5848028bc11c3ed0470c3d2735b9038f4c85bbde))
- Config option to control the generation of a sitemap file in a prebuild step: `config.app.prebuild.sitemap`. Defaults to `true`. ([02d8b65](https://github.com/slsfi/digital-edition-frontend-ng/commit/02d8b6558ce5e80e7c56f896a24bf536d5001c61))
- Config option to define the intrinsic dimensions of the default banner image on the home page: `config.page.home.bannerImage.intrinsicSize`. The option defaults to `null`, meaning that the `height` and `width` attributes are not set on the image. The option takes an object with `height` and `width` keys and their respective values as numbers (the implicit unit is pixels). Setting the intrinsic dimensions of the image file (defined by the `config.page.home.bannerImage.URL` option) is recommended since the browser can then calculate the aspect ratio of the image, which improves initial page rendering. ([4495d91](https://github.com/slsfi/digital-edition-frontend-ng/commit/4495d915fd9899a28745d7f2de9cd61482e4bf21))
- Config option to define alternate image sources for the banner image on the home page: `config.page.home.bannerImage.alternateSources`. The option defaults to an empty array, which means that the banner image is rendered like before using the image URL provided in `config.page.home.bannerImage.URL`. The new `alternateSources` option takes an array of objects. If the array is non-empty, the banner image will be created as a [`<picture>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/picture) element with each of the objects in the array specifying a [`<source>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/source) HTML element. The object can contain key-value pairs where the keys are the allowed attributes of the `<source>` element (`media`, `srcset`, `sizes`, `type`, `height`, `width`) and the values are strings or numbers defining the values of the corresponding attributes. For examples, see the forthcoming documentation. Using the `alternateSources` option makes it possible to define responsive images for the banner image (serve different image files based on screen resolution) and serve modern image formats like AVIF for reduced bandwidth. The default image defined by the `URL` option is still needed – it is used as the fallback image defined by the `<img>` element in the `<picture>` element. ([49708b7](https://github.com/slsfi/digital-edition-frontend-ng/commit/49708b7a82290df89df6e8f22ccc4ec780d6fc2d))
- The current text title in the text-changer component is appended with the value of the `text_two` property of the TOC item if the property exists. The previous/next text buttons have been changed into links and are thus crawlable. ([5848028](https://github.com/slsfi/digital-edition-frontend-ng/commit/5848028bc11c3ed0470c3d2735b9038f4c85bbde))
- `Vary: User-Agent` HTTP response header to server-side rendered content. This enables more efficient caching and improves SEO by telling browsers etc. that the content varies by user agent (mobile vs desktop). ([1160490](https://github.com/slsfi/digital-edition-frontend-ng/commit/116049015209c7f0e8a124b90c513f1b1194d49a))

### Changed

- Defer loading of the facsimile component on the collection text page to the browser. This increases server-side rendering performance since the component isn’t rendered on the server. ([69fa89a](https://github.com/slsfi/digital-edition-frontend-ng/commit/69fa89ae585b486594f905e649cb46262e38a330), [5bbdaae](https://github.com/slsfi/digital-edition-frontend-ng/commit/5bbdaae6f93b9e7223ddcb122fe031aa896479b6))
- Defer loading of the illustrations component on the collection text page to the browser. This increases server-side rendering performance since the component isn’t rendered on the server. ([eb60a82](https://github.com/slsfi/digital-edition-frontend-ng/commit/eb60a8292fa912bad9636c980dbafaa75121e081))
- Defer loading of the epub viewer component to the browser, since it’s not SSR-compatible. The epub title is shown as a `<h1>` placeholder in the server response. Also show pdf title as `<h1>` in the pdf viewer component. ([7658b71](https://github.com/slsfi/digital-edition-frontend-ng/commit/7658b71b5eef956c5d012589dbaa08df6820872a))
- Refactor requests for flattened collection table of contents to use function in the collection TOC service. ([a6b643b](https://github.com/slsfi/digital-edition-frontend-ng/commit/a6b643b490eccf9241eb221a7dae5d2c41162711))
- Refactor the download texts modal to get the current text title from the document head service. ([baa0a44](https://github.com/slsfi/digital-edition-frontend-ng/commit/baa0a4437c7bfe0d1e14c04c896d52180f6f38ac))
- Update the development notes with brief descriptions of dependencies. ([34a1a7c](https://github.com/slsfi/digital-edition-frontend-ng/commit/34a1a7cbdf9ed04dde97a0dc141b0daf8c8d9273))
- Deps: update `@angular` to 17.2.1. ([e78ed03](https://github.com/slsfi/digital-edition-frontend-ng/commit/e78ed039c3097d6789500324ceb5262399e023c7), [0dffb42](https://github.com/slsfi/digital-edition-frontend-ng/commit/0dffb421f71dd199a8bfd456934168030dbaff5d), [073f167](https://github.com/slsfi/digital-edition-frontend-ng/commit/073f167d93edf3355b80c1ce2db8811e46c3d9b0))
- Deps: update `@ionic` to 7.7.2. ([5b57491](https://github.com/slsfi/digital-edition-frontend-ng/commit/5b5749109f8ae9d7f468ccd8099782b7e336d531), [7bd4e41](https://github.com/slsfi/digital-edition-frontend-ng/commit/7bd4e414cb3ee0fad266fa83c5f72b8329817904), [ad8b502](https://github.com/slsfi/digital-edition-frontend-ng/commit/ad8b502ef6af7b46482da02a7c5188313ad98eb5))
- Deps: update `marked` to 12.0.0. ([17dc71e](https://github.com/slsfi/digital-edition-frontend-ng/commit/17dc71e985203472b58a162ec843e9023b42c778), [dd6548b](https://github.com/slsfi/digital-edition-frontend-ng/commit/dd6548be1fb66f1ace074a1d292bd7f1f1ec7927))
- Deps: update `zone.js` to 0.14.4. ([47d90dd](https://github.com/slsfi/digital-edition-frontend-ng/commit/47d90dddba786fbf00d65deac77ec008862fe072))
- Deps: update `jasmine-core` to 5.1.2. ([3e2402b](https://github.com/slsfi/digital-edition-frontend-ng/commit/3e2402bd5cbbdbc7ec0914c96d3b85cc287ea06d))
- Deps: update `ng-extract-i18n-merge` to 2.10.0. ([0387016](https://github.com/slsfi/digital-edition-frontend-ng/commit/03870166b32684955a908d9d771beefdafa6af43))
- Deps: update `@types/node` to 20.11.19. ([75f2527](https://github.com/slsfi/digital-edition-frontend-ng/commit/75f252755cb0a7028145e9919a80366eec8df7b0), [90bc7f3](https://github.com/slsfi/digital-edition-frontend-ng/commit/90bc7f39c5725f1efe14ee9c5c428aba6f1f04aa), [67e4e80](https://github.com/slsfi/digital-edition-frontend-ng/commit/67e4e801fa6a6997a10e355c511a6f15a6104027))

### Fixed

- Set correct app mode (desktop or mobile) on the server. Prior to this fix the server app would always return the app rendered in desktop mode, regardless of the actual client device. Previously Ionic’s Platform service was used to determine the current device in the browser, but since it’s not SSR-compatible, the user agent string is now used instead. On the server, the user agent is read from the request headers, and in the browser from the `Window.navigator` object. The app mode is now correctly set for most devices and browsers. One notable exception is Safari on iPads with iOS 13+, which are recognized as desktop devices. Using only the user agent string, it is not possible to distinguish Safari on iPads with iOS 13+ from Safari on MacBooks with MacOS. This fix makes the app compatible with Angular hydration, and nullifies the unreleased changes in [a2f3ea2](https://github.com/slsfi/digital-edition-frontend-ng/commit/a2f3ea276497d410d744a3a88486d0fa57188f66). ([7a9efed](https://github.com/slsfi/digital-edition-frontend-ng/commit/7a9efed0680a2718d91055da9b9efe4be438fa99))

### Removed

- Deps: `xliff`. ([7475e83](https://github.com/slsfi/digital-edition-frontend-ng/commit/7475e832b944e6059a4f7b062ca3fe6af98dcd73))



## [1.2.3] – 2024-01-26

### Fixed

- Broken server-side rendering for non-default locales. Before this commit pages in non-default locales that used the `UrlService` were not rendered on the server. This was a side effect of the [`@jsonurl/jsonurl`](https://github.com/jsonurl/jsonurl-js) library used by the service to convert primitive data types and complex data structures like arrays, arrays of objects and objects with nested arrays and objects into URL-safe strings and vice versa. This fix removes the dependency on the external library and replaces its functionality with a custom conversion implementation. The custom implementation is not a full implementation of the [JSON→URL specification](https://github.com/jsonurl/specification/), but produces the same results for the parts that are relevant for this project. The code has been generated by ChatGPT-4 according to the JSON→URL specification, meticulously guided by a human mind. ([e4ff558](https://github.com/slsfi/digital-edition-frontend-ng/commit/e4ff5581b82efa2438a5eb3a03ce787bbfa0473b))



## [1.2.2] – 2024-01-25

### Changed

- Fix indentation in [`nginx.conf`](/nginx.conf). ([779b217](https://github.com/slsfi/digital-edition-frontend-ng/commit/779b21778e35591aa43cdddabf0f9682c9df40e7))
- Use `ARG` instructions in [`Dockerfile`](/Dockerfile) to define variables for setting Angular major version and Node image tag of the base image. This makes updating `Dockerfile` clearer as the Angular major version has to be changed in the file when the Angular major version of the app is updated. ([700b4e5](https://github.com/slsfi/digital-edition-frontend-ng/commit/700b4e53e574e937b36e8bd0b76546c798f7d5ab))
- Refactor functions and services related to markdown content. Remove duplicate code by moving functions for getting markdown content to the markdown service. Add pipe for marking HTML safe (bypassing sanitization) in order to separate the getting and parsing of markdown to HTML from the trusting of the HTML. Rename MarkdownContentService MarkdownService. ([a294791](https://github.com/slsfi/digital-edition-frontend-ng/commit/a294791f2946ec66d5b32557ba2f7d8ae030fe98))
- Replace `bypassSecurityTrustHtml` function calls with `trustHtml` pipe. ([b698c67](https://github.com/slsfi/digital-edition-frontend-ng/commit/b698c677f40dba5d073688e7d30e524e101bc63f))
- Run MathJax only in the browser. ([d92853c](https://github.com/slsfi/digital-edition-frontend-ng/commit/d92853c15435c07d40ed79ea1a2ef9cf9f98eb6e))
- Deps: update Angular to 17.1.1. ([3aba10e](https://github.com/slsfi/digital-edition-frontend-ng/commit/3aba10e41213d7e18a1af120f1ecd63eec2a4fda), [a3783f2](https://github.com/slsfi/digital-edition-frontend-ng/commit/a3783f2d6b4f6f30ef14b6766a22d524b8e60dd8))
- Deps: update Ionic to 7.6.6. ([1baa779](https://github.com/slsfi/digital-edition-frontend-ng/commit/1baa779dd2e4853d78513dffb2de4a19a5be5d44))
- Deps: update htmlparser2 to 9.1.0. ([3a28300](https://github.com/slsfi/digital-edition-frontend-ng/commit/3a28300a9b2594e1b3a8da3a92d1e8cb547292c2))
- Deps: update marked to 11.1.1 and remove @types/marked. Move markdown parsing to function in dedicated markdown service. ([2d214df](https://github.com/slsfi/digital-edition-frontend-ng/commit/2d214df0a76c5fd5d82e760b02ecbf9a9823b141))
- Deps: update zone.js to 0.14.3. ([9a33558](https://github.com/slsfi/digital-edition-frontend-ng/commit/9a335581bd6edaa84437b56b90866c440f9af714))
- Moved @angular/compiler from devDependencies to dependencies (like in fresh Angular 17 apps). ([c8a680d](https://github.com/slsfi/digital-edition-frontend-ng/commit/c8a680da970c5f27f76088186fe9555f0dcf98a5))
- Deps: update typescript to 5.3.3. ([c2ef241](https://github.com/slsfi/digital-edition-frontend-ng/commit/c2ef241c96610f915b201f272de5be07735852d9))
- Deps: update @types/node to 20.11.5. ([ba5a0ea](https://github.com/slsfi/digital-edition-frontend-ng/commit/ba5a0ea2a69721e7ece6d54b3bd803a153247200))
- Deps: update browser-sync to 3.0.2. ([7f65bed](https://github.com/slsfi/digital-edition-frontend-ng/commit/7f65bed1369ca517ce108ee6bf4e3ba7948b4c00))
- Deps: update jasmine-core to 5.1.1 and @types/jasmine to 5.1.4. ([b548e78](https://github.com/slsfi/digital-edition-frontend-ng/commit/b548e789674599298a79076136a5d98d404ed774))

### Removed

- Deps: angular-eslint from devDependencies. ([c719b45](https://github.com/slsfi/digital-edition-frontend-ng/commit/c719b45b41c93379f9819ad7d01e267c572ab52c))
- Deps: jasmine-spec-reporter from devDependencies. ([a9e0702](https://github.com/slsfi/digital-edition-frontend-ng/commit/a9e070215e15adb5f1078b688ab7bd347d316270))
- Deps: karma-coverage-istanbul-reporter from devDependencies. ([f27d677](https://github.com/slsfi/digital-edition-frontend-ng/commit/f27d6770d2623acea2f07067952edec0529976cd))
- Deps: ts-node from devDependencies. ([e55173f](https://github.com/slsfi/digital-edition-frontend-ng/commit/e55173f496db494fcd369b414efa1adf5353beb9))



## [1.2.1] – 2024-01-16

### Added

- Compression of static files. During the build step, static files of type `html`, `xml`, `txt`, `css`, `js`, `svg`, `ico`, `json`, `ttf` and `otf` in `dist/app/browser/` are precompressed using gzip. Files smaller than 1300 B are not compressed. If there is a compressed version of a static file, nginx is configured to serve it instead of the uncompressed file. The necessary directives for compressing dynamically generated HTML on-the-fly have also been added to the nginx configuration ([`nginx.conf`](/nginx.conf)), however, the directives have been commented out because of the increased server CPU load associated with on-the-fly compression. Each project can choose to enable the directives as they see fit. ([667b535](https://github.com/slsfi/digital-edition-frontend-ng/commit/667b535290b161648641d1c15c449bef01a1b9a8))

### Fixed

- Legacy setup code from Angular 15 to 17 migration. Angular 17 introduced several changes to the `app.module.\*`, `main.server.ts`, `main.ts`, `server.ts` and `tsconfig.\*` files. During the original v15 -> v17 update of the app all of these changes were not implemented. This fix attempts to align the app with the setup of a new modules based Angular 17 app that has SSR and i18n enabled. ([2b7c94d](https://github.com/slsfi/digital-edition-frontend-ng/commit/2b7c94d368adc51de871322ea1e4dcb3df74f5fd))



## [1.2.0] – 2024-01-10

### Added

- Config option to specify the dimensions of the site logo in the top menu: `config.component.topMenu.siteLogoDimensions` ([7402e28](https://github.com/slsfi/digital-edition-frontend-ng/commit/7402e280cae7c3f6472f7ca7c2a8e57f0795afa1)). The new config option is an object containing nested objects for specifying the height and width of the logo in both desktop and mobile mode. If the option is omitted, it defaults to an empty object, which corresponds to the old behaviour where the height and width attributes of the HTMLImageElement of the logo are not set. Setting the dimensions reduces layout shifts during page loading. Structure of the `siteLogoDimensions` with example values:

```
siteLogoDimensions: {
  default: {
    height: 56,
    width: 173
  },
  mobile: {
    height: 56,
    width: 56
  }
}
```

- Documentation on updating, building and deployment, as well as development. ([c329aa8](https://github.com/slsfi/digital-edition-frontend-ng/commit/c329aa8c0eaf357d948cb6ca75b9685b2e4f2134))

### Changed

- Default site logo in top menu changed to optimized PNG image file. Added both black and white versions of SLS’s logo to `assets/images/logo/`. ([9df4bef](https://github.com/slsfi/digital-edition-frontend-ng/commit/9df4bef940ddd66c6087daa93bee9fd166b4e731))
- Deps: update Angular dev-kit, CLI and SSR to 17.0.9. ([c67b22e](https://github.com/slsfi/digital-edition-frontend-ng/commit/c67b22e89fd459b850c523d679f1653ea5e2eaeb))
- Deps: update dev-dependency follow-redirects to 1.15.4. ([30355ea](https://github.com/slsfi/digital-edition-frontend-ng/commit/30355ea87e03c68c31df87ed34bb85cadd9e1f35))



## [1.1.1] – 2024-01-09

### Added

- nginx web server to serve static files in front of Node. This improves performance under load since 1) nginx is more performant than Node’s Express-server, 2) nginx’s performance is not impacted by Node being busy with server-side rendering tasks for dynamic content. ([8952fdc](https://github.com/slsfi/digital-edition-frontend-ng/commit/8952fdcdfece942363b37ef7567da7c344541382) by [@rasek-sls](https://github.com/rasek-sls))

### Changed

- Paths to font files in @font-face rules from absolute to relative. ([2dd2bf3](https://github.com/slsfi/digital-edition-frontend-ng/commit/2dd2bf34d76233f5eafc15e607a491a7800e1a38))
- Deps: update Ionic to 7.6.3 and Ionicons to 7.2.2. ([f35d148](https://github.com/slsfi/digital-edition-frontend-ng/commit/f35d14831bec9aa7430c43a4bd7854c3f77871b9))



## [1.1.0] – 2023-12-28

### Added

- Config option to show or hide the toggle for switching between the normalized and non-normalized version of manuscripts: `config.component.manuscripts.showNormalizedToggle`. The new config option defaults to `true`, which corresponds to the old behaviour. ([930eec2](https://github.com/slsfi/digital-edition-frontend-ng/commit/930eec227765d662726e2f9124d9763766fe73e2))
- Config option to add mandatory TEI class names to collection text HTML loaded from the backend: `config.collections.addTEIClassNames`. The new config option defaults to `true`, which corresponds to the old behaviour. If set to `false`, the class attributes of all HTML elements in reading texts, manuscripts and variants fetched from the backend, must contain the value `tei`. In addition, elements in comments must contain the class name `teiComment`, elements in manuscripts the class name `teiManuscript`, and elements in variants `teiVariant`. Otherwise, some inherent functionality and styles won’t work anymore for these texts. Setting the new config option to `false` improves app performance. ([df6554d](https://github.com/slsfi/digital-edition-frontend-ng/commit/df6554d6a7105b64dd109b308dc9c7ed82c274e5), [b8984f8](https://github.com/slsfi/digital-edition-frontend-ng/commit/b8984f8b7abf85f0c05438c4d2232776464538db))
- Config option to fix paths to the `assets/images/` folder in collection texts: `config.collections.replaceImageAssetsPaths`. The new config option defaults to `true`, which corresponds to the old behaviour. When this option is `true`, `src` attribute values starting with `images/` in the HTML of collection texts are replaced with `assets/images/`, which is the correct path to the image assets folder. Setting the new config option to `false` improves app performance. ([1f9d7ed](https://github.com/slsfi/digital-edition-frontend-ng/commit/1f9d7ed89135001dfececdea586f567d5c1388af))

### Changed

- Eagerly load home page banner image in portrait mode. ([5d11e3c](https://github.com/slsfi/digital-edition-frontend-ng/commit/5d11e3cce6b57335e8c6ae8816f5bd38aefa414f))
- Deps: update Angular to 17.0.8. ([e936d0b](https://github.com/slsfi/digital-edition-frontend-ng/commit/e936d0b097877cca2d61ff93ddee53b14583672b))
- Deps: update ng-extract-i18n-merge to 2.9.1. ([98e567b](https://github.com/slsfi/digital-edition-frontend-ng/commit/98e567b691d0e7c2550e2bbe5bc6015859e4798f))

### Fixed

- Show placeholder image for collections in the content grid on the content and home page if unable to retrieve collection cover image URL from the backend. Previously a missing cover image URL disrupted loading of all collections in the grid. ([3f3b256](https://github.com/slsfi/digital-edition-frontend-ng/commit/3f3b256d1926a982ff81fd704f1e36cd445182e4))

### Removed

- Trimming of collection texts fetched from backend. ([990a08c](https://github.com/slsfi/digital-edition-frontend-ng/commit/990a08c54b1207bcd3e290c3307d2d480901b8fe))



## [1.0.3] – 2023-12-14

### Added

- GitHub Actions workflow definition for triggering builds on commit push to `main` branch or new release/tag. ([aa32c39](https://github.com/slsfi/digital-edition-frontend-ng/commit/aa32c3941b335219f5e1d68ebbcb9ba6ece21312), [a5b22e7](https://github.com/slsfi/digital-edition-frontend-ng/commit/a5b22e7ca599b27fcf98e2996a8e40b9de801557), [a7be6c3](https://github.com/slsfi/digital-edition-frontend-ng/commit/a7be6c3b71e059af6192d03303064e6c2d219cf2), [00b19e4](https://github.com/slsfi/digital-edition-frontend-ng/commit/00b19e43a3270d83744f84e700e898df51b81c08) by [@rasek-sls](https://github.com/rasek-sls))

### Changed

- Update base app Docker image repository and tag in `compose.yml`. ([8bdfc5a](https://github.com/slsfi/digital-edition-frontend-ng/commit/8bdfc5a04b5e138ce12fafb69c7e90730dad73f9))
- Update README, CHANGELOG and build workflow code comments. ([35d373d](https://github.com/slsfi/digital-edition-frontend-ng/commit/35d373d67254638574483eae01f7a8a6415bba68))
- Deps: update Angular to 17.0.7. ([90028cf](https://github.com/slsfi/digital-edition-frontend-ng/commit/90028cfae667383603fd8852412ec7448ec6da5a))

### Fixed

- Remove incomplete regex sanitization of script tags in search query results. The regex sanitization is unnecessary because the query results are anyway parsed as HTML, only text nodes are retained and any `<`, `>` characters are converted to their corresponding HTML entities. ([ce54078](https://github.com/slsfi/digital-edition-frontend-ng/commit/ce540787c76c28554b241f140138531cb08ba6d2))



## [1.0.2] – 2023-12-11

### Changed

- Doodle illustrations must be placed in a media collection in the backend rather than in the hard coded `src/assets/images/verk/` folder in the frontend. Use `collections.mediaCollectionMappings` in `config.ts` to map the id of the collection with doodles to the id of the media collection that holds the images in the backend. ([9fd9d0e](https://github.com/slsfi/digital-edition-frontend-ng/commit/9fd9d0e7ab003e2d0dc3fd18c6e8c0edba88d7f5), [02d3d21](https://github.com/slsfi/digital-edition-frontend-ng/commit/02d3d21fbdc24f785e29db6a80acbe8409e91d0d))
- Illustration image path mapping to media collections is performed solely based on the presence of the CSS class name `est_figure_graphic` on `img` elements – not as previously based on the image `src` containing `assets/images/verk/` in it. Thus, illustration images that are to be mapped to media collections must have just the image file names in the `src` attributes, rather than `images/verk/<filename>` as previously. Images with absolute URLs in `src` are never mapped regardless of class names. ([2b4f4e6](https://github.com/slsfi/digital-edition-frontend-ng/commit/2b4f4e6fed6020562e0927c8a72969662a80e536))
- Fixing image paths in collection pages from `images/` to `assets/images/` is done specifically at the start of `src` attribute values – not for any occurrence of the string `images/`. ([111f902](https://github.com/slsfi/digital-edition-frontend-ng/commit/111f9022c4771f271cb812fc9c887c0faa93ece3))

### Removed

- Legacy settings from Angular configuration file. ([fbfc51c](https://github.com/slsfi/digital-edition-frontend-ng/commit/fbfc51c52b3681e265a28db0132b247fb3b136df))



## [1.0.1] – 2023-12-07

### Added

- Matching text color to page break toggle labels in the view options popover. ([514f999](https://github.com/slsfi/digital-edition-frontend-ng/commit/514f999d2fb4965a29a7253552c67f505f2394ee))

### Changed

- Apply background colors to toggle labels only instead of the entire toggles in the view options popover. ([fc2fc38](https://github.com/slsfi/digital-edition-frontend-ng/commit/fc2fc38c64d3c4d66c2838769f9cac74f0a72a08))
- Adjust padding of facsimile page number input elements to accommodate changed spec in Ionic 7.6.0. ([34d1ab0](https://github.com/slsfi/digital-edition-frontend-ng/commit/34d1ab074e03d386f01e6fe00e1fe5e0409dcfb5))
- Move inline styles for checkbox labels on the elastic-search page to the component SCSS-file. ([8d0a766](https://github.com/slsfi/digital-edition-frontend-ng/commit/8d0a76692396c77715fa570ac32e8f19bfd6b41a))
- Deps: update Ionic to 7.6.0. ([9c66917](https://github.com/slsfi/digital-edition-frontend-ng/commit/9c66917e8df33e96c5ac115aae618c6bce453c4a))
- Deps: update Angular to 17.0.6. ([bf878ae](https://github.com/slsfi/digital-edition-frontend-ng/commit/bf878aeeeb7a6100b81f4e1e808e7913806ec5b8))



## [1.0.0] – 2023-12-05

- Initial release.



[unreleased]: https://github.com/slsfi/digital-edition-frontend-ng/compare/1.5.5...HEAD
[1.5.5]: https://github.com/slsfi/digital-edition-frontend-ng/compare/1.5.4...1.5.5
[1.5.4]: https://github.com/slsfi/digital-edition-frontend-ng/compare/1.5.3...1.5.4
[1.5.3]: https://github.com/slsfi/digital-edition-frontend-ng/compare/1.5.2...1.5.3
[1.5.2]: https://github.com/slsfi/digital-edition-frontend-ng/compare/1.5.1...1.5.2
[1.5.1]: https://github.com/slsfi/digital-edition-frontend-ng/compare/1.5.0...1.5.1
[1.5.0]: https://github.com/slsfi/digital-edition-frontend-ng/compare/1.4.4...1.5.0
[1.4.4]: https://github.com/slsfi/digital-edition-frontend-ng/compare/1.4.3...1.4.4
[1.4.3]: https://github.com/slsfi/digital-edition-frontend-ng/compare/1.4.2...1.4.3
[1.4.2]: https://github.com/slsfi/digital-edition-frontend-ng/compare/1.4.1...1.4.2
[1.4.1]: https://github.com/slsfi/digital-edition-frontend-ng/compare/1.4.0...1.4.1
[1.4.0]: https://github.com/slsfi/digital-edition-frontend-ng/compare/1.3.4...1.4.0
[1.3.4]: https://github.com/slsfi/digital-edition-frontend-ng/compare/1.3.3...1.3.4
[1.3.3]: https://github.com/slsfi/digital-edition-frontend-ng/compare/1.3.2...1.3.3
[1.3.2]: https://github.com/slsfi/digital-edition-frontend-ng/compare/1.3.1...1.3.2
[1.3.1]: https://github.com/slsfi/digital-edition-frontend-ng/compare/1.3.0...1.3.1
[1.3.0]: https://github.com/slsfi/digital-edition-frontend-ng/compare/1.2.3...1.3.0
[1.2.3]: https://github.com/slsfi/digital-edition-frontend-ng/compare/1.2.2...1.2.3
[1.2.2]: https://github.com/slsfi/digital-edition-frontend-ng/compare/1.2.1...1.2.2
[1.2.1]: https://github.com/slsfi/digital-edition-frontend-ng/compare/1.2.0...1.2.1
[1.2.0]: https://github.com/slsfi/digital-edition-frontend-ng/compare/1.1.1...1.2.0
[1.1.1]: https://github.com/slsfi/digital-edition-frontend-ng/compare/1.1.0...1.1.1
[1.1.0]: https://github.com/slsfi/digital-edition-frontend-ng/compare/1.0.3...1.1.0
[1.0.3]: https://github.com/slsfi/digital-edition-frontend-ng/compare/v1.0.2...1.0.3
[1.0.2]: https://github.com/slsfi/digital-edition-frontend-ng/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/slsfi/digital-edition-frontend-ng/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/slsfi/digital-edition-frontend-ng/releases/tag/v1.0.0
