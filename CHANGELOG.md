# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Base app Docker image repository and tag in `compose.yml`.

### Fixed

- Remove incomplete regex sanitization of script tags in search query results. The regex sanitization is unnecessary because the query results are anyway parsed as HTML, only text nodes are retained and any `<`, `>` characters are converted to their corresponding HTML entities.

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

- Update Ionic to 7.6.0. ([9c66917](https://github.com/slsfi/digital-edition-frontend-ng/commit/9c66917e8df33e96c5ac115aae618c6bce453c4a))
- Update Angular to 17.0.6. ([bf878ae](https://github.com/slsfi/digital-edition-frontend-ng/commit/bf878aeeeb7a6100b81f4e1e808e7913806ec5b8))
- Apply background colors to toggle labels only instead of the entire toggles in the view options popover. ([fc2fc38](https://github.com/slsfi/digital-edition-frontend-ng/commit/fc2fc38c64d3c4d66c2838769f9cac74f0a72a08))
- Adjust padding of facsimile page number input elements to accommodate changed spec in Ionic 7.6.0. ([34d1ab0](https://github.com/slsfi/digital-edition-frontend-ng/commit/34d1ab074e03d386f01e6fe00e1fe5e0409dcfb5))
- Move inline styles for checkbox labels on the elastic-search page to the component SCSS-file. ([8d0a766](https://github.com/slsfi/digital-edition-frontend-ng/commit/8d0a76692396c77715fa570ac32e8f19bfd6b41a))

## [1.0.0] – 2023-12-05

- Initial release.

[unreleased]: https://github.com/slsfi/digital-edition-frontend-ng/compare/v1.0.2...HEAD
[1.0.2]: https://github.com/slsfi/digital-edition-frontend-ng/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/slsfi/digital-edition-frontend-ng/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/slsfi/digital-edition-frontend-ng/releases/tag/v1.0.0
