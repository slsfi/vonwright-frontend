const fs = require('fs');
const path = require('path');
const common = require('./prebuild-common-fns');

const configFilepath = 'src/assets/config/config.ts';
const translationsPath = 'src/locale/';
const outputPath = 'src/static-html/collection-toc/';
const tocFetchRetries = 3;
const tocFetchRetryDelay = 2000;
const tocFetchRetryDelayIncrement = 1000;

if (require.main === module) {
  generateStaticCollectionMenus();
}


/**
 * Generates .htm files with prerendered HTML of collection
 * side menus. Each file holds an HTML fragment which is a static
 * version of a collection’s table of contents in a specific
 * language. The files are named <collection_id>_<language>.htm.
 * The collections’ TOC-files in JSON format are fetched from
 * the backend, flattened and parsed into a single-level
 * unordered HTML-list.
 */
async function generateStaticCollectionMenus() {
  const config = common.getConfig(configFilepath);
  const generateStaticMenus = config.app?.prebuild?.staticCollectionMenus ?? true;
  const ssrCollectionSideMenu = config.app?.ssr?.collectionSideMenu ?? false;
  const authEnabled = config.app?.auth?.enabled === true;

  if (authEnabled) {
    console.log('Skipping generation of static collection menus, auth is enabled.\n');
    return;
  } else if (!generateStaticMenus) {
    console.log('Skipping generation of static collection menus, disabled in config.\n');
    return;
  } else if (ssrCollectionSideMenu) {
    console.log('Skipping generation of static collection menus, server-side rendering of collection side menu is enabled.\n');
    return;
  } else {
    console.log('Generating static collection menus ...');
  }

  const projectName = config.app?.projectNameDB ?? '';
  const API = config.app?.backendBaseURL ?? '';
  const languages = config.app?.i18n?.languages ?? [];
  const multilingualCollectionTOC = config.app?.i18n?.multilingualCollectionTableOfContents ?? false;
  const fmPages = config.collections?.frontMatterPages ?? {};
  const includedCollections = config.collections?.order?.flat() ?? [];
  const APIBase = API + '/' + projectName;

  // Fail early if critical config is missing
  if (!projectName || !API || !languages.length) {
    console.error('Critical config values missing: cannot generate static collection menus.');
    process.exit(1);
  }

  let createdFilesCount = 0;
  let linksCount = 0;
  const locales = languages.map(lang => lang.code);
  const fmPagesTranslations = getFrontMatterTranslations(locales, fmPages);

  // A non-multilingual collection TOC is shared by every output locale. Use a
  // single data pass in that case, while localized TOCs retain one pass per locale.
  const dataLocales = multilingualCollectionTOC ? locales : [null];

  for (const dataLocale of dataLocales) {
    // Fetch collections
    let collectionsEndpoint = APIBase + '/collections';
    if (dataLocale) {
      collectionsEndpoint += '/' + dataLocale;
    }

    const collections = await common.fetchWithRetry(collectionsEndpoint);
    if (!collections) {
      const affectedLocales = dataLocale ? `locale "${dataLocale}"` : 'all locales';
      console.warn(`Skipping ${affectedLocales}: could not fetch collections from ${collectionsEndpoint}`);
      continue;
    }

    const outputLocales = dataLocale ? [dataLocale] : locales;
    let tocFetchCount = 0;

    // Loop through each collection
    for (const collection of collections) {
      const collectionId = collection?.id;
      const collectionTitle = collection?.title ?? '';

      if (!collectionId || !includedCollections.includes(collectionId)) {
        continue;
      }

      if (tocFetchCount > 0 && tocFetchCount % 10 === 0) {
        // Pause after every 10 actual TOC requests to avoid backend overload
        await common.sleep(2000);
      }
      tocFetchCount++;

      // Fetch TOC for collection
      let tocEndpoint = APIBase + '/toc/' + collectionId;
      if (dataLocale) {
        tocEndpoint += '/' + dataLocale;
      }

      const tocJSON = await common.fetchWithRetry(
        tocEndpoint,
        tocFetchRetries,
        tocFetchRetryDelay,
        tocFetchRetryDelayIncrement
      );
      if (!tocJSON) {
        const affectedLocales = dataLocale ? dataLocale : outputLocales.join(', ');
        console.warn(`Skipping collection ${collectionId} (${affectedLocales}): could not fetch TOC from ${tocEndpoint}`);
        continue;
      }

      const toc = common.flattenObjectTree(tocJSON, 'children', 'itemId');
      if (!toc || !toc.length) {
        const affectedLocales = dataLocale ? dataLocale : outputLocales.join(', ');
        console.warn(`Collection ${collectionId} (${affectedLocales}) has empty TOC.`);
        continue;
      }

      for (const locale of outputLocales) {
        const generatedMenu = generateStaticCollectionMenu(
          collectionId,
          collectionTitle,
          toc,
          locale,
          fmPagesTranslations[locale],
          config
        );
        if (generatedMenu.created) {
          createdFilesCount++;
          linksCount += generatedMenu.links;
        }
      }
    }
  }

  console.log(`Generated html files: ${createdFilesCount} (${languages.length} languages, ${linksCount} links)`);
}


function getFrontMatterTranslations(locales, fmPages) {
  const translations = {};

  for (const locale of locales) {
    translations[locale] = {};
    for (const [page, enabled] of Object.entries(fmPages)) {
      if (enabled) {
        const translationId = page === 'cover' ? 'CollectionCover.Cover'
          : page === 'title' ? 'CollectionTitle.TitlePage'
          : page === 'foreword' ? 'CollectionForeword.Foreword'
          : page === 'introduction' ? 'CollectionIntroduction.Introduction'
          : '';
        translations[locale][page] = common.getTranslation(translationsPath, locale, translationId);
      }
    }
  }

  return translations;
}


function generateStaticCollectionMenu(collectionId, collectionTitle, toc, locale, fmPagesTranslations, config) {
  // The .htm file extension is used here on purpose so these files can be
  // distinguished from other HTML files with .html extension and excluded
  // from compression when serving them uncompressed is more efficient.
  const filename = `${collectionId}_${locale}.htm`;
  let html = `<p><b>${collectionTitle}</b></p>\n`;
  if (!initializeOutputFile(filename, html)) {
    console.warn(`Could not initialize file ${outputPath + filename}`);
    return { created: false, links: 0 };
  }

  let links = 0;
  appendToFile(filename, '<ul>\n');

  // Front matter links
  for (const [page, text] of Object.entries(fmPagesTranslations)) {
    if (common.enableFrontMatterPage(page, collectionId, config)) {
      html = `<li><a href="/${locale}/collection/${collectionId}/${page}">${text}</a></li>\n`;
      appendToFile(filename, html);
      links++;
    }
  }

  // TOC item links
  for (const item of toc) {
    const itemId = item?.itemId?.split(';')[0];
    const posId = item?.itemId?.split(';')[1] ?? null;
    if (!itemId) continue;

    const parts = itemId.split('_');
    if (parts.length > 1) {
      const textId = parts[1];
      const chapterId = parts[2] || '';

      let url = `/${locale}/collection/${collectionId}/text/${textId}`;
      if (chapterId) url += `/${chapterId}`;
      if (posId) url += `?position=${posId}`;

      const linkText = String(item.text ?? '').trim();
      html = `<li><a href="${url}">${linkText}</a></li>\n`;
      appendToFile(filename, html);
      links++;
    }
  }

  appendToFile(filename, '</ul>\n');
  return { created: true, links };
}


function initializeOutputFile(filename, content) {
  try {
    fs.writeFileSync(path.join(__dirname, outputPath + filename), content);
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
}

function appendToFile(filename, content) {
  try {
    fs.appendFileSync(path.join(__dirname, outputPath + filename), content);
  } catch (err) {
    console.error(err);
  }
}


module.exports = {
  generateStaticCollectionMenus
};
