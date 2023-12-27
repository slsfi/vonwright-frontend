# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- Update Angular to 17.0.8.

## [1.0.3] – 2023-12-14

### Added

- GitHub Actions workflow definition for triggering builds on commit push to `main` branch or new release/tag. ([aa32c39](https://github.com/slsfi/digital-edition-frontend-ng/commit/aa32c3941b335219f5e1d68ebbcb9ba6ece21312), [a5b22e7](https://github.com/slsfi/digital-edition-frontend-ng/commit/a5b22e7ca599b27fcf98e2996a8e40b9de801557), [a7be6c3](https://github.com/slsfi/digital-edition-frontend-ng/commit/a7be6c3b71e059af6192d03303064e6c2d219cf2), [00b19e4](https://github.com/slsfi/digital-edition-frontend-ng/commit/00b19e43a3270d83744f84e700e898df51b81c08))

### Changed

- Update Angular to 17.0.7. ([90028cf](https://github.com/slsfi/digital-edition-frontend-ng/commit/90028cfae667383603fd8852412ec7448ec6da5a))
- Update base app Docker image repository and tag in `compose.yml`. ([8bdfc5a](https://github.com/slsfi/digital-edition-frontend-ng/commit/8bdfc5a04b5e138ce12fafb69c7e90730dad73f9))
- Update README, CHANGELOG and build workflow code comments. ([35d373d](https://github.com/slsfi/digital-edition-frontend-ng/commit/35d373d67254638574483eae01f7a8a6415bba68))

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

- Update Ionic to 7.6.0. ([9c66917](https://github.com/slsfi/digital-edition-frontend-ng/commit/9c66917e8df33e96c5ac115aae618c6bce453c4a))
- Update Angular to 17.0.6. ([bf878ae](https://github.com/slsfi/digital-edition-frontend-ng/commit/bf878aeeeb7a6100b81f4e1e808e7913806ec5b8))
- Apply background colors to toggle labels only instead of the entire toggles in the view options popover. ([fc2fc38](https://github.com/slsfi/digital-edition-frontend-ng/commit/fc2fc38c64d3c4d66c2838769f9cac74f0a72a08))
- Adjust padding of facsimile page number input elements to accommodate changed spec in Ionic 7.6.0. ([34d1ab0](https://github.com/slsfi/digital-edition-frontend-ng/commit/34d1ab074e03d386f01e6fe00e1fe5e0409dcfb5))
- Move inline styles for checkbox labels on the elastic-search page to the component SCSS-file. ([8d0a766](https://github.com/slsfi/digital-edition-frontend-ng/commit/8d0a76692396c77715fa570ac32e8f19bfd6b41a))

## [1.0.0] – 2023-12-05

- Initial release.

[unreleased]: https://github.com/slsfi/digital-edition-frontend-ng/compare/1.0.3...HEAD
[1.0.3]: https://github.com/slsfi/digital-edition-frontend-ng/compare/v1.0.2...1.0.3
[1.0.2]: https://github.com/slsfi/digital-edition-frontend-ng/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/slsfi/digital-edition-frontend-ng/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/slsfi/digital-edition-frontend-ng/releases/tag/v1.0.0
