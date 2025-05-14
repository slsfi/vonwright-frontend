const fs = require('fs');
const path = require('path');
const common = require('./prebuild-common-fns');

const configFilepath = 'src/assets/config/config.ts';
const translationsPath = 'src/locale/';
const outputPath = 'src/static-html/collection-toc/';

generateStaticCollectionMenus();


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

  if (generateStaticMenus && !ssrCollectionSideMenu) {
    console.log('Generating static collection menus ...');
  } else if (generateStaticMenus && ssrCollectionSideMenu) {
    console.log('Skipping generation of static collection menus, server-side rendering of collection side menu is enabled.\n');
    return;
  } else {
    console.log('Skipping generation of static collection menus, disabled in config.\n');
    return;
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

  // Loop through all locales
  for (const lang of languages) {
    const locale = lang.code;

    // Load translations
    const transl = {};
    for (const [page, enabled] of Object.entries(fmPages)) {
      if (enabled) {
        const translationId = page === 'cover' ? 'CollectionCover.Cover'
          : page === 'title' ? 'CollectionTitle.TitlePage'
          : page === 'foreword' ? 'CollectionForeword.Foreword'
          : page === 'introduction' ? 'CollectionIntroduction.Introduction'
          : '';
        const text = common.getTranslation(translationsPath, locale, translationId);
        transl[page] = text;
      }
    }

    // Fetch collections
    let collectionsEndpoint = APIBase + '/collections';
    if (multilingualCollectionTOC) {
      collectionsEndpoint += '/' + locale;
    }

    const collections = await common.fetchFromAPI(collectionsEndpoint);
    if (!collections) {
      console.warn(`Skipping locale "${locale}": could not fetch collections from ${collectionsEndpoint}`);
      continue;
    }

    // Loop through each collection
    for (const collection of collections) {
      const collectionId = collection?.id;
      const collectionTitle = collection?.title ?? '';

      if (!collectionId || !includedCollections.includes(collectionId)) {
        continue;
      }

      // Fetch TOC for collection
      let tocEndpoint = APIBase + '/toc/' + collectionId;
      if (multilingualCollectionTOC) {
        tocEndpoint += '/' + locale;
      }

      const tocJSON = await common.fetchFromAPI(tocEndpoint);
      if (!tocJSON) {
        console.warn(`Skipping collection ${collectionId} (${locale}): could not fetch TOC from ${tocEndpoint}`);
        continue;
      }

      const toc = common.flattenObjectTree(tocJSON, 'children', 'itemId');
      if (!toc || !toc.length) {
        console.warn(`Collection ${collectionId} (${locale}) has empty TOC.`);
        continue;
      }

      // Generate HTML fragment
      // The .htm file extension is used here on purpose so these
      // files can be distinguished from other HTML files with
      // .html extension. This way you can easily prevent the
      // files from being gzipped by removing "htm" from the file
      // formats that gzipper compresses in package.json. Serving
      // gzipped versions of the static TOC files might put an
      // unecessary load on the server.
      const filename = `${collectionId}_${locale}.htm`;
      let html = `<p><b>${collectionTitle}</b></p>\n`;
      if (!initializeOutputFile(filename, html)) {
        console.warn(`Could not initialize file ${outputPath + filename}`);
        continue;
      }
      createdFilesCount++;

      appendToFile(filename, '<ul>\n');

      // Front matter links
      for (const [page, text] of Object.entries(transl)) {
        html = `<li><a href="/${locale}/collection/${collectionId}/${page}">${text}</a></li>\n`;
        appendToFile(filename, html);
        linksCount++;
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
          linksCount++;
        }
      }

      appendToFile(filename, '</ul>\n');
    }
  }

  console.log(`Generated html files: ${createdFilesCount} (${languages.length} languages, ${linksCount} links)`);
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
