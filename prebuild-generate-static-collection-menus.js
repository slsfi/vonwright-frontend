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
  const fmPages = config.collections?.frontMatterPages ?? {}
  const APIBase = API + '/' + projectName;

  let createdFilesCount = 0;
  let linksCount = 0;

  // Loop through all languages/locales
  for (let l = 0; l < languages.length; l++) {
    const locale = languages[l]['code'];

    // Get translations for front matter pages
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

    // Get collections
    if (config.collections?.order?.length) {
      let collectionsEndpoint = APIBase + '/collections';
      if (multilingualCollectionTOC) {
        collectionsEndpoint += '/' + locale;
      }

      const collections = await common.fetchFromAPI(collectionsEndpoint);
      const includedCollections = config.collections.order.flat();

      if (collections) {
        // Loop through all collections
        for (let i = 0; i < collections.length; i++) {
          const collectionId = collections[i]['id'] || 0;
          const collectionTitle = collections[i]['title'] || '';

          if (!collectionId || !includedCollections.includes(collectionId)) {
            continue;
          }

          // Get collection TOC
          let tocEndpoint = APIBase + '/toc/' + collectionId;
          if (multilingualCollectionTOC) {
            tocEndpoint += '/' + locale;
          }
          
          const tocJSON = await common.fetchFromAPI(tocEndpoint);

          if (tocJSON == null) {
            console.log('Error: unable to fetch TOC for collection ', collectionId);
            break;
          }

          const toc = common.flattenObjectTree(tocJSON, 'children', 'itemId');

          if (toc.length < 1) {
            break;
          }

          // Initialize output file and add collection title.
          // The .htm file extension is used here on purpose so these
          // files can be distinguished from other HTML files with
          // .html extension. This way you can easily prevent the
          // files from being gzipped by removing "htm" from the file
          // formats that gzipper compresses in package.json. Serving
          // gzipped versions of the static TOC files might put an
          // unecessary load on the server.
          const filename = collectionId + '_' + locale + '.htm';
          let html = '<p><b>' + collectionTitle + '</b></p>\n';
          const fileWriteSuccess = initializeOutputFile(filename, html);
          if (!fileWriteSuccess) {
            console.log('Error: unable to initialize collection toc file: ', outputPath + filename);
            break;
          } else {
            createdFilesCount++;
          }

          // Add unordered list
          appendToFile(filename, '<ul>\n');

          // Add links to front matter pages
          for (const [page, text] of Object.entries(transl)) {
            html = '<li><a href="' + `/${locale}/collection/${collectionId}/${page}` + '">' + text + '</a></li>\n';
            appendToFile(filename, html);
            linksCount++;
          }

          // Loop through collection TOC and add links to all items
          for (let i = 0; i < toc.length; i++) {
            if (toc[i]['itemId']) {
              const itemId = toc[i]['itemId'].split(';')[0];
              const posId = toc[i]['itemId'].split(';')[1] ?? null;
              const itemIdParts = itemId.split('_');
              if (itemIdParts.length > 1) {
                const textId = itemIdParts[1];
                const chapterId = itemIdParts[2] || '';
      
                let url = `/${locale}/collection/${collectionId}/text/${textId}`;
                if (chapterId) {
                  url += '/' + chapterId;
                }
                if (posId) {
                  url += '?position=' + posId;
                }

                // Write to file
                html = '<li><a href="' + url + '">' + (`${toc[i]['text']}`).trim() + '</a></li>\n';
                appendToFile(filename, html);
                linksCount++;
              }
            }
          }

          appendToFile(filename, '</ul>\n');
        }
      }
    }
  }

  const summary = `Generated html files: ${createdFilesCount} (${languages.length} languages, ${linksCount} links)\n`;
  console.log(summary);
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
